# Third-party notice

Copied unchanged from [KaguraNanaga/document-format-skills](https://github.com/KaguraNanaga/document-format-skills),
commit `a1005d13c3429d40cc1e5a5db677555cd672f930`, MIT licensed (see `LICENSE`):

- `scripts/__init__.py`, `scripts/analyzer.py`, `scripts/converter.py`, `scripts/fix_spacing.py`,
  `scripts/fix_spacing_simple.py`, `scripts/formatter.py`, `scripts/from_text.py`,
  `scripts/process.py`, `scripts/punctuation.py`
- `requirements.txt`

Changed by spec.jev:

- `SKILL.md`: written for this app — the upstream one is named `document-format-skills` and uses
  `uv run --with python-docx`; the commands here call `python` directly.

Added by spec.jev:

- `scripts/preflight.py`: reports which Python dependency is missing, with the command to install it.
