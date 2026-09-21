"""Unit tests for read-only SQL guardrails (SIL-323)."""

from __future__ import annotations

import pytest

from app.services.brokerage_db_mcp import QueryGuardrailError, validate_read_only_sql


def test_allows_simple_select_and_appends_limit():
    out = validate_read_only_sql(
        "SELECT agent_id, COUNT(*) AS n FROM skyslope_transactions GROUP BY agent_id"
    )
    assert out.lower().startswith("select")
    assert "limit 500" in out.lower()


def test_caps_existing_limit():
    out = validate_read_only_sql("SELECT 1 LIMIT 9999")
    assert out.lower().endswith("limit 500")


def test_preserves_limit_when_within_cap():
    out = validate_read_only_sql("SELECT 1 LIMIT 10")
    assert out.lower().endswith("limit 10")


def test_allows_with_cte():
    sql = """
    WITH closed AS (
      SELECT * FROM skyslope_transactions WHERE is_cancelled = false
    )
    SELECT agent_id, COUNT(*) FROM closed GROUP BY agent_id
    """
    out = validate_read_only_sql(sql)
    assert out.lower().lstrip().startswith("with")
    assert "limit" in out.lower()


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM skyslope_transactions",
        "UPDATE skyslope_transactions SET status = 'x'",
        "INSERT INTO skyslope_transactions (id) VALUES ('1')",
        "DROP TABLE skyslope_transactions",
        "ALTER TABLE skyslope_transactions ADD COLUMN x INT",
        "TRUNCATE skyslope_transactions",
        "SELECT 1; DELETE FROM skyslope_transactions",
        "SELECT * INTO tmp FROM skyslope_transactions",
    ],
)
def test_rejects_writes_and_ddl(sql: str):
    with pytest.raises(QueryGuardrailError):
        validate_read_only_sql(sql)


def test_rejects_empty():
    with pytest.raises(QueryGuardrailError) as exc:
        validate_read_only_sql("   ")
    assert exc.value.code == "empty_sql"


def test_rejects_comment_only():
    with pytest.raises(QueryGuardrailError):
        validate_read_only_sql("-- just a comment")


@pytest.mark.parametrize(
    "sql,code",
    [
        ("SELECT * FROM t FOR UPDATE", "banned_phrase"),
        ("SELECT pg_read_file('/etc/passwd')", "banned_phrase"),
        ("SELECT lo_export(1, '/tmp/x')", "banned_phrase"),
        ("COPY skyslope_transactions TO STDOUT", "not_select"),
        ("GRANT SELECT ON skyslope_transactions TO public", "not_select"),
    ],
)
def test_rejects_escalation_phrases_and_keywords(sql: str, code: str):
    with pytest.raises(QueryGuardrailError) as exc:
        validate_read_only_sql(sql)
    assert exc.value.code == code


def test_rejects_invalid_max_limit():
    with pytest.raises(QueryGuardrailError) as exc:
        validate_read_only_sql("SELECT 1", max_limit=0)
    assert exc.value.code == "invalid_limit"


def test_preserves_limit_with_offset():
    out = validate_read_only_sql("SELECT 1 LIMIT 25 OFFSET 10")
    assert "limit 25" in out.lower()
    assert "offset 10" in out.lower()


def test_comment_cannot_hide_second_statement():
    # After comment strip, still one SELECT — should pass
    out = validate_read_only_sql("SELECT 1 -- DELETE FROM t")
    assert "limit" in out.lower()

    # Real multi-statement still fails
    with pytest.raises(QueryGuardrailError) as exc:
        validate_read_only_sql("SELECT 1; DELETE FROM t")
    assert exc.value.code == "multiple_statements"


def test_semicolon_inside_string_is_not_multi_statement():
    out = validate_read_only_sql("SELECT 'a;b' AS note")
    assert "limit" in out.lower()
    assert out.lower().count("select") == 1
