"""Import Korean PoE2 essence descriptions from a downloaded PoE2DB Essence page.

Usage: python scripts/import_poe2db_essences.py /tmp/poe2-essence.html
Requires lxml. Do not silently synthesize missing rules.
"""
import json
import pathlib
import sys
from lxml import html


def clean(value):
    return ' '.join(value.split())


def main():
    page = html.parse(sys.argv[1]).getroot().get_element_by_id('에센스')
    entries = []
    seen = set()
    for link in page.xpath('.//a[contains(concat(" ",normalize-space(@class)," ")," item_currency ")]'):
        name = clean(link.text_content())
        if not name.endswith('에센스') or name in seen:
            continue
        parent = link.getparent()
        details = parent.xpath('./div/div[contains(concat(" ",normalize-space(@class)," ")," explicitMod ")]')
        if not details:
            continue
        lines = [clean(x.text_content()) for x in details]
        action = lines[0]
        options = []
        for text in lines[1:]:
            if ': ' in text:
                target, effect = text.split(': ', 1)
                options.append({'target': target, 'effect': effect})
        entries.append({'id': link.get('href'), 'name': name, 'action': action, 'options': options})
        seen.add(name)
    if len(entries) < 60:
        raise SystemExit(f'Incomplete essence import: {len(entries)} entries')
    output = pathlib.Path(__file__).resolve().parents[1] / 'data' / 'poe2db-essences.js'
    output.write_text('// Source: https://poe2db.tw/kr/Essence; exact Korean item tooltips.\n'
        'export const essenceCatalogue = ' + json.dumps(entries, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'{len(entries)} Korean essences written to {output}')
    print('Targets:', sorted({x['target'] for row in entries for x in row['options']}))


if __name__ == '__main__':
    main()
