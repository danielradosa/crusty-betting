#!/usr/bin/env python3
import re
import json
import time
import argparse
from urllib.request import Request, urlopen
from urllib.parse import urlencode

RAW_ATP = '/Users/daniel/personal/sportology/data/raw_atp.txt'
RAW_WTA = '/Users/daniel/personal/sportology/data/raw_wta.txt'
RAW_ITTF_MEN = '/Users/daniel/personal/sportology/data/raw_ittf_men.txt'
RAW_ITTF_WOMEN = '/Users/daniel/personal/sportology/data/raw_ittf_women.txt'

OUT_JSON = '/Users/daniel/personal/sportology/data/seed_players_generated.json'

USER_AGENT = 'Mozilla/5.0 (OpenClaw seed script)'
CACHE_PATH = '/Users/daniel/personal/sportology/data/wikidata_cache.json'

COUNTRY_PHRASES = {
    'Chinese Taipei', 'Korea Republic', 'Hong Kong, China', 'Macao, China', 'Puerto Rico', 'United States',
    'Great Britain', 'South Africa', 'Czech Republic', 'United Kingdom', 'Hong Kong', 'Chinese', 'Taipei',
    'Hong', 'Kong,', 'China', 'Japan', 'Germany', 'France', 'Sweden', 'Brazil', 'Slovenia', 'Denmark', 'Croatia',
    'Egypt', 'India', 'Nigeria', 'Australia', 'Czechia', 'Romania', 'Belgium', 'Algeria', 'England', 'Portugal',
    'Kazakhstan', 'USA', 'Poland', 'Cameroon', 'Iran', 'Malta', 'Canada', 'Benin', 'Austria', 'Singapore',
    'Wales', 'Austria', 'Croatia', 'Ukraine', 'Türkiye', 'Netherlands', 'Thailand', 'Serbia', 'Spain', 'Chile',
    'AIN'
}

COUNTRY_PHRASE_LIST = [
    'Hong Kong, China', 'Macao, China', 'Chinese Taipei', 'Korea Republic', 'Puerto Rico'
]


def clean_name_tokens(tokens):
    clean = []
    for t in tokens:
        if t.lower() == 'avatar':
            continue
        if re.search(r'\d', t):
            continue
        if t.startswith('+') or t.startswith('-'):
            continue
        if t.startswith('(') and t.endswith(')'):
            continue
        clean.append(t)
    return clean


LOWER_PARTICLES = {'de','del','da','di','van','von','der','den','la','le','du','dos','das','do','della','mac','mc'}


def normalize_tokens(tokens):
    out = []
    for t in tokens:
        if t.isupper():
            t = t.title()
        if t.lower() in LOWER_PARTICLES:
            t = t.lower()
        out.append(t)
    return out


def reorder_last_first(tokens):
    # move last token to front: "Last First" -> "First Last"
    if len(tokens) >= 2:
        return [tokens[-1]] + tokens[:-1]
    return tokens


def parse_ranked_list(raw_text, limit=200):
    tokens = raw_text.strip().split()
    names = []
    i = 0
    while i < len(tokens):
        if re.match(r'^\d+\.?$', tokens[i]):
            rank_token = tokens[i]
            rank = int(rank_token[:-1]) if rank_token.endswith('.') else int(rank_token)
            i += 1
            name_tokens = []
            while i < len(tokens):
                t = tokens[i]
                if re.match(r'^\d+\.?$', t):
                    break
                if re.search(r'\d', t):
                    break
                if t in ['W', 'R16', 'R32', 'QF', 'SF', 'F', 'Q']:
                    break
                name_tokens.append(t)
                i += 1
            name_tokens = clean_name_tokens(name_tokens)
            if name_tokens:
                name_tokens = reorder_last_first(name_tokens)
                name_tokens = normalize_tokens(name_tokens)
                name = ' '.join(name_tokens)
                names.append((rank, name))
            if len(names) >= limit:
                break
        else:
            i += 1
    names = sorted(names, key=lambda x: x[0])
    return [n for _, n in names[:limit]]


def strip_country_from_name(name_tokens):
    joined = ' '.join(name_tokens)
    for phrase in COUNTRY_PHRASE_LIST:
        if joined.endswith(' ' + phrase) or joined == phrase:
            return joined[: -(len(phrase) + 1)].split()
    while name_tokens and name_tokens[-1] in COUNTRY_PHRASES:
        name_tokens = name_tokens[:-1]
    return name_tokens


def parse_ittf_list(raw_text, limit=100):
    tokens = raw_text.strip().split()
    names = []
    i = 0
    while i < len(tokens):
        if re.match(r'^\d+$', tokens[i]):
            rank = int(tokens[i])
            i += 1
            if i < len(tokens) and re.match(r'^\d+$', tokens[i]):
                i += 1
            if i < len(tokens) and tokens[i].lower() == 'avatar':
                i += 1
            row_tokens = []
            while i < len(tokens) and not re.match(r'^\d+$', tokens[i]):
                row_tokens.append(tokens[i])
                i += 1
            name_tokens = clean_name_tokens(row_tokens)
            name_tokens = strip_country_from_name(name_tokens)
            if name_tokens:
                # if first token is all caps, move it to end
                if name_tokens and name_tokens[0].isupper():
                    name_tokens = name_tokens[1:] + [name_tokens[0]]
                name_tokens = normalize_tokens(name_tokens)
                name = ' '.join(name_tokens)
                names.append((rank, name))
            if len(names) >= limit:
                break
        else:
            i += 1
    names = sorted(names, key=lambda x: x[0])
    return [n for _, n in names[:limit]]


def request_json(url, retries=5, backoff=2.0):
    for attempt in range(retries):
        try:
            req = Request(url, headers={'User-Agent': USER_AGENT})
            return json.loads(urlopen(req).read().decode())
        except Exception as e:
            if 'HTTP Error 429' in str(e) and attempt < retries - 1:
                time.sleep(backoff)
                backoff *= 1.7
                continue
            raise


def wikidata_search(name, sport):
    q = f"{name} {sport}" if sport else name
    params = {
        'action': 'wbsearchentities',
        'search': q,
        'language': 'en',
        'format': 'json',
        'limit': 5,
    }
    url = 'https://www.wikidata.org/w/api.php?' + urlencode(params)
    data = request_json(url)
    return data.get('search', [])


def wikidata_get(entity_id):
    params = {
        'action': 'wbgetentities',
        'ids': entity_id,
        'format': 'json',
        'props': 'claims|descriptions|labels'
    }
    url = 'https://www.wikidata.org/w/api.php?' + urlencode(params)
    data = request_json(url)
    return data.get('entities', {}).get(entity_id)


def pick_entity(search_results, sport_keyword):
    for item in search_results:
        desc = (item.get('description') or '').lower()
        if sport_keyword in desc:
            return item.get('id')
    return search_results[0].get('id') if search_results else None


def extract_birthdate(entity):
    claims = entity.get('claims', {}) if entity else {}
    if 'P569' in claims:
        try:
            datavalue = claims['P569'][0]['mainsnak']['datavalue']
            time_str = datavalue['value']['time']
            return time_str.strip('+')[:10]
        except Exception:
            return None
    return None


def extract_country(entity):
    claims = entity.get('claims', {}) if entity else {}
    if 'P27' in claims:
        try:
            country_id = claims['P27'][0]['mainsnak']['datavalue']['value']['id']
            params = {
                'action': 'wbgetentities',
                'ids': country_id,
                'format': 'json',
                'props': 'labels'
            }
            url = 'https://www.wikidata.org/w/api.php?' + urlencode(params)
            data = request_json(url)
            label = data['entities'][country_id]['labels'].get('en', {}).get('value')
            return label
        except Exception:
            return None
    return None


def load_cache():
    try:
        with open(CACHE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def save_cache(cache):
    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def enrich_players(names, sport, sport_keyword, limit=None):
    enriched = []
    cache = load_cache()
    if limit:
        names = names[:limit]

    for idx, name in enumerate(names):
        cache_key = f"{sport}:{name}"
        if cache_key in cache:
            enriched.append(cache[cache_key])
            continue

        search_results = wikidata_search(name, sport_keyword)
        if not search_results:
            search_results = wikidata_search(name, '')
        entity_id = pick_entity(search_results, sport_keyword)
        birthdate = None
        country = None
        if entity_id:
            entity = wikidata_get(entity_id)
            birthdate = extract_birthdate(entity)
            country = extract_country(entity)

        record = {
            'name': name,
            'birthdate': birthdate or '',
            'sport': sport,
            'country': country or ''
        }
        cache[cache_key] = record
        enriched.append(record)

        if idx % 20 == 0:
            save_cache(cache)
        time.sleep(0.35)

    save_cache(cache)
    return enriched


def load_raw_lists():
    atp_raw = open(RAW_ATP, 'r', encoding='utf-8').read()
    wta_raw = open(RAW_WTA, 'r', encoding='utf-8').read()
    ittf_m_raw = open(RAW_ITTF_MEN, 'r', encoding='utf-8').read()
    ittf_w_raw = open(RAW_ITTF_WOMEN, 'r', encoding='utf-8').read()

    atp_names = parse_ranked_list(atp_raw, limit=200)
    wta_names = parse_ranked_list(wta_raw, limit=200)
    ittf_m_names = parse_ittf_list(ittf_m_raw, limit=100)
    ittf_w_names = parse_ittf_list(ittf_w_raw, limit=100)

    return atp_names, wta_names, ittf_m_names, ittf_w_names


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--chunk', choices=['atp', 'wta', 'ittf-men', 'ittf-women', 'all'], default='all')
    parser.add_argument('--start', type=int, default=0)
    parser.add_argument('--count', type=int, default=0)
    args = parser.parse_args()

    atp_names, wta_names, ittf_m_names, ittf_w_names = load_raw_lists()

    def slice_names(lst):
        if args.count and args.count > 0:
            return lst[args.start: args.start + args.count]
        if args.start > 0:
            return lst[args.start:]
        return lst

    players = []
    if args.chunk in ['atp', 'all']:
        players.extend(enrich_players(slice_names(atp_names), 'tennis', 'tennis player'))
    if args.chunk in ['wta', 'all']:
        players.extend(enrich_players(slice_names(wta_names), 'tennis', 'tennis player'))
    if args.chunk in ['ittf-men', 'all']:
        players.extend(enrich_players(slice_names(ittf_m_names), 'table-tennis', 'table tennis'))
    if args.chunk in ['ittf-women', 'all']:
        players.extend(enrich_players(slice_names(ittf_w_names), 'table-tennis', 'table tennis'))

    # merge with existing file if present
    existing = []
    try:
        with open(OUT_JSON, 'r', encoding='utf-8') as f:
            existing = json.load(f)
    except Exception:
        existing = []

    merged = existing + players
    # dedupe by sport+name
    seen = set()
    deduped = []
    for p in merged:
        k = (p['sport'], p['name'].lower())
        if k in seen:
            continue
        seen.add(k)
        deduped.append(p)

    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(deduped, f, ensure_ascii=False, indent=2)

    print(f"Chunk {args.chunk} done. Total players in file: {len(deduped)}")

if __name__ == '__main__':
    main()
