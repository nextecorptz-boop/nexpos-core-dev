# Gemini Operating Rules

You are assisting on NEXPOS.

Mandatory:

- Never modify auth.users directly.
- Never modify auth.identities directly.
- Never create seed data in Supabase auth tables.
- Use Supabase Auth APIs only.

Before coding:

1. Analyze
2. Explain
3. Implement
4. Verify

Priority:

Security > Correctness > Scalability > Speed

If schema changes are needed:
Generate migrations.

If uncertain:
Ask before modifying infrastructure.