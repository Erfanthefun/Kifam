#!/bin/bash
# اجرای همه‌ی تست‌ها: هسته (node) + end-to-end (Playwright)
cd "$(dirname "$0")/.."
node tests/core.test.js || exit 1
python3 tests/e2e.py
