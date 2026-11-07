#!/usr/bin/env python3
"""Report this skill's Python dependencies before a command fails halfway through."""

import sys

REQUIRED = [("docx", "python-docx", "python-docx>=0.8.11")]


def main():
    missing = []
    for module, name, package in REQUIRED:
        try:
            __import__(module)
        except ImportError:
            missing.append((name, package))

    if not missing:
        print("ok: python-docx is importable")
        return 0

    for name, package in missing:
        print(f"missing: {name}")
    print("install with: python -m pip install --user " + " ".join(f'"{package}"' for _, package in missing))
    return 1


if __name__ == "__main__":
    sys.exit(main())
