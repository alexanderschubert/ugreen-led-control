#!/usr/bin/env python3
"""Checks and exports the interface texts of src/web/js/i18n.js.

  scripts/i18n.py check            every language against English (CI runs this)
  scripts/i18n.py export [lang]    one language as JSON, e.g. as the template for a translation

check fails (exit 1) on
  - a key that English doesn't have,
  - a missing key in German (a language may be partial: missing keys show in English; they are listed),
  - {placeholders} or HTML tags that differ from the English text,
  - an empty text.
"""
import json
import re
import sys

I18N = 'src/web/js/i18n.js'
LINE = re.compile(r"^        '([^']+)': '((?:[^'\\]|\\.)*)',?\s*$")


def load():
    langs, current = {}, None
    for line in open(I18N, encoding='utf-8'):
        block = re.match(r'^    (\w+): \{\s*$', line)
        if block:
            current = block.group(1)
            langs[current] = {}
            continue
        if re.match(r'^    \},?\s*$', line):
            current = None
            continue
        match = LINE.match(line)
        if current and match:
            langs[current][match.group(1)] = re.sub(r"\\(['\\])", r'\1', match.group(2))
    return langs


def check(langs):
    en = langs.get('en', {})
    problems, notes = [], []
    placeholders = lambda text: sorted(re.findall(r'\{\w+\}', text))
    tags = lambda text: re.findall(r'<[^>]+>', text)

    for lang, texts in langs.items():
        if lang == 'en':
            continue
        for key in texts:
            # api.<English message>: translations of messages api.php sends in English
            if key not in en and not key.startswith('api.'):
                problems.append(f'{lang}: "{key}" is not in English')
        missing = [key for key in en if key not in texts]
        if missing and lang == 'de':
            problems.append(f'de: {len(missing)} missing: {", ".join(missing[:5])}…')
        elif missing:
            notes.append(f'{lang}: {len(missing)} of {len(en)} texts still English')
        for key, text in texts.items():
            if key not in en:
                continue
            if not text.strip():
                problems.append(f'{lang}: "{key}" is empty')
            if placeholders(text) != placeholders(en[key]):
                problems.append(f'{lang}: "{key}" placeholders {placeholders(text)} != {placeholders(en[key])}')
            if tags(text) != tags(en[key]):
                problems.append(f'{lang}: "{key}" HTML tags differ from English')

    for note in notes:
        print('note:', note)
    for problem in problems:
        print('ERROR:', problem, file=sys.stderr)
    if not problems:
        print('Interface texts: ' + ', '.join(f'{lang} {len(texts)}' for lang, texts in langs.items()))
    return 1 if problems else 0


def main():
    langs = load()
    command = sys.argv[1] if len(sys.argv) > 1 else 'check'

    if command == 'check':
        return check(langs)
    if command == 'export':
        lang = sys.argv[2] if len(sys.argv) > 2 else 'en'
        print(json.dumps(langs[lang], ensure_ascii=False, indent=2))
        return 0

    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
