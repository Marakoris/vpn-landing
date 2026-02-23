#!/usr/bin/env python3
"""
Сбор семантического ядра через Яндекс Директ API (Wordstat)
"""

import requests
import json
import time
import csv
from collections import defaultdict

TOKEN = "y0__xCq-NS0ARiRiDsgqIj86RQRd8-eY-v7KjP-0gNii-OIH0qzlw"
API_URL = "https://api.direct.yandex.com/v4/json/"
GEO_RUSSIA = [225]  # Вся Россия

def api_call(method, param):
    """Вызов API Яндекс Директ v4"""
    payload = json.dumps({
        "method": method,
        "token": TOKEN,
        "param": param
    }, ensure_ascii=False).encode('utf-8')
    resp = requests.post(API_URL, data=payload,
                         headers={"Content-Type": "application/json; charset=utf-8"})
    return resp.json()

def create_report(phrases):
    """Создать отчёт Wordstat (макс 10 фраз)"""
    result = api_call("CreateNewWordstatReport", {
        "Phrases": phrases,
        "GeoID": GEO_RUSSIA
    })
    if "data" in result:
        return result["data"]
    print(f"  ERROR creating report: {result}")
    return None

def wait_report(report_id, max_wait=120):
    """Ждать готовности отчёта"""
    for i in range(max_wait // 5):
        time.sleep(5)
        result = api_call("GetWordstatReportList", [])
        if "data" in result:
            for r in result["data"]:
                if r["ReportID"] == report_id and r["StatusReport"] == "Done":
                    return True
    return False

def get_report(report_id):
    """Получить данные отчёта"""
    result = api_call("GetWordstatReport", report_id)
    if "data" in result:
        return result["data"]
    print(f"  ERROR getting report: {result}")
    return None

def delete_report(report_id):
    """Удалить отчёт"""
    api_call("DeleteWordstatReport", report_id)

def collect_nested_keywords(seed_batches):
    """Собрать все вложенные запросы по маскам"""
    all_keywords = {}  # keyword -> base_frequency

    for batch_num, batch in enumerate(seed_batches, 1):
        print(f"\n=== Batch {batch_num}/{len(seed_batches)}: {batch[:3]}... ===")

        report_id = create_report(batch)
        if not report_id:
            continue

        print(f"  Report ID: {report_id}, waiting...")
        if not wait_report(report_id):
            print(f"  TIMEOUT waiting for report")
            delete_report(report_id)
            continue

        data = get_report(report_id)
        if not data:
            continue

        for item in data:
            phrase = item["Phrase"]
            # Вложенные запросы (левая колонка Wordstat)
            for kw_data in item.get("SearchedWith", []):
                kw = kw_data["Phrase"].lower().strip()
                shows = kw_data["Shows"]
                if shows >= 10:  # Отсекаем совсем мелочь
                    if kw not in all_keywords or all_keywords[kw] < shows:
                        all_keywords[kw] = shows

            # Похожие запросы (правая колонка)
            for kw_data in item.get("SearchedAlso", []):
                kw = kw_data["Phrase"].lower().strip()
                shows = kw_data["Shows"]
                if shows >= 10:
                    if kw not in all_keywords or all_keywords[kw] < shows:
                        all_keywords[kw] = shows

        count = len(all_keywords)
        print(f"  Collected. Total unique keywords so far: {count}")

        delete_report(report_id)
        time.sleep(2)  # Пауза между батчами

    return all_keywords

def collect_exact_frequency(keywords, batch_size=10):
    """Собрать точную частотность ("!keyword") для списка ключей"""
    exact_freq = {}
    kw_list = list(keywords)

    for i in range(0, len(kw_list), batch_size):
        batch = kw_list[i:i+batch_size]
        # Формат точного соответствия: "!слово1 !слово2"
        exact_phrases = []
        for kw in batch:
            words = kw.split()
            exact = '"' + ' '.join(f'!{w}' for w in words) + '"'
            exact_phrases.append(exact)

        batch_num = i // batch_size + 1
        total_batches = (len(kw_list) + batch_size - 1) // batch_size
        print(f"\n  Exact freq batch {batch_num}/{total_batches}")

        report_id = create_report(exact_phrases)
        if not report_id:
            continue

        if not wait_report(report_id):
            print(f"  TIMEOUT")
            delete_report(report_id)
            continue

        data = get_report(report_id)
        if data:
            for j, item in enumerate(data):
                original_kw = batch[j]
                # Точная частотность — первый элемент SearchedWith
                if item.get("SearchedWith") and len(item["SearchedWith"]) > 0:
                    exact_freq[original_kw] = item["SearchedWith"][0]["Shows"]
                else:
                    exact_freq[original_kw] = 0

        delete_report(report_id)
        time.sleep(2)

    return exact_freq

def classify_intent(keyword):
    """Классификация интента запроса"""
    kw = keyword.lower()

    transactional = ['купить', 'скачать', 'подписка', 'подключить', 'установить',
                     'оформить', 'заказать', 'активировать', 'оплатить', 'download']
    commercial = ['лучший', 'топ', 'рейтинг', 'сравнение', 'обзор', 'отзывы',
                  'vs', 'альтернатива', 'какой', 'выбрать', 'недорого', 'дешевый',
                  'цена', 'тариф', 'стоимость', 'бесплатн']
    informational = ['как ', 'что такое', 'зачем', 'почему', 'можно ли', 'чем отличается',
                     'инструкция', 'настроить', 'работает ли', 'отличие']

    for w in transactional:
        if w in kw:
            return 'T'  # Transactional
    for w in commercial:
        if w in kw:
            return 'C'  # Commercial
    for w in informational:
        if w in kw:
            return 'I'  # Informational

    # По умолчанию — коммерческий если содержит vpn/впн
    if 'vpn' in kw or 'впн' in kw:
        return 'C'
    return 'I'

def filter_keywords(keywords, exact_freq):
    """Фильтрация нерелевантных ключей"""
    # Стоп-слова
    competitor_brands = ['nordvpn', 'expressvpn', 'surfshark', 'protonvpn', 'proton vpn',
                        'mullvad', 'cyberghost', 'purevpn', 'hidemy', 'windscribe',
                        'tunnelbear', 'hotspot shield', 'kaspersky', 'adguard',
                        'browsec', 'opera vpn', 'planet vpn', 'zoogvpn']

    stop_words = ['crack', 'взлом', 'keygen', 'пиратск', 'торрент',
                  'своими руками', 'роутер', 'mikrotik', 'keenetic',
                  'телевизор', 'smart tv', 'playstation', 'xbox',
                  'сервер своими', 'openvpn сервер', 'wireguard сервер']

    filtered = {}
    removed_reasons = defaultdict(int)

    for kw, base_freq in keywords.items():
        kw_lower = kw.lower()

        # Проверка конкурентов
        skip = False
        for brand in competitor_brands:
            if brand in kw_lower:
                removed_reasons['competitor_brand'] += 1
                skip = True
                break
        if skip:
            continue

        # Проверка стоп-слов
        for sw in stop_words:
            if sw in kw_lower:
                removed_reasons['stop_word'] += 1
                skip = True
                break
        if skip:
            continue

        # Точная частотность
        exact = exact_freq.get(kw, 0)
        if exact < 5:
            removed_reasons['low_exact_freq'] += 1
            continue

        filtered[kw] = {
            'base_freq': base_freq,
            'exact_freq': exact,
            'intent': classify_intent(kw)
        }

    print(f"\nFiltering stats:")
    for reason, count in sorted(removed_reasons.items()):
        print(f"  Removed ({reason}): {count}")

    return filtered

def assign_cluster(keyword):
    """Назначить кластер для привязки к секции лендинга"""
    kw = keyword.lower()

    if any(w in kw for w in ['скачать', 'download', 'установить', 'приложение']):
        return 'CTA / Download'
    if any(w in kw for w in ['купить', 'подписка', 'цена', 'тариф', 'стоимость', 'оплат']):
        return 'Pricing'
    if any(w in kw for w in ['для youtube', 'для ютуб', 'для telegram', 'для instagram',
                              'для игр', 'для стриминг', 'для netflix']):
        return 'Use Cases'
    if any(w in kw for w in ['быстр', 'безопасн', 'без логов', 'шифрован', 'анонимн',
                              'без ограничен', 'безлимит']):
        return 'Features'
    if any(w in kw for w in ['лучший', 'топ', 'рейтинг', 'сравнен', 'обзор', 'какой']):
        return 'Hero / Comparison'
    if any(w in kw for w in ['как ', 'что такое', 'зачем', 'почему', 'работает ли',
                              'настроить', 'подключить']):
        return 'FAQ / How-to'
    if any(w in kw for w in ['обход', 'блокировк', 'разблокир', 'заблокирован']):
        return 'Hero / Unblock'
    if any(w in kw for w in ['vless', 'shadowsocks', 'xray', 'v2ray', 'reality']):
        return 'Features / Tech'
    if any(w in kw for w in ['россия', 'россий', 'для рф']):
        return 'Hero / Geo'

    return 'General'


def main():
    print("=" * 60)
    print("СБОР СЕМАНТИЧЕСКОГО ЯДРА — NoBorder VPN")
    print("=" * 60)

    # === ЭТАП 1: Маски для сбора вложенных запросов ===
    seed_batches = [
        # Batch 1: Основные
        ["vpn", "впн", "скачать vpn", "купить vpn",
         "vpn обход блокировок", "vpn для youtube", "vpn для telegram",
         "vpn для instagram", "быстрый vpn", "vpn без ограничений"],

        # Batch 2: Технические + платформы
        ["vless vpn", "shadowsocks vpn", "vpn россия", "впн для ютуба",
         "vpn сервис", "vpn подписка", "vpn тариф", "безопасный vpn",
         "vpn для android", "vpn для iphone"],

        # Batch 3: Дополнительные
        ["vpn для компьютера", "vpn приложение", "обход блокировок",
         "разблокировать youtube", "vpn 2026", "vpn недорого",
         "vpn для windows", "анонимайзер", "впн скачать", "впн купить"],

        # Batch 4: Long-tail и специфика
        ["vpn для обхода блокировок в россии", "какой vpn работает в россии",
         "vpn для chatgpt", "vpn для spotify", "vpn для стриминга",
         "vpn без замедления", "vpn с пробным периодом",
         "vpn для телефона", "лучший vpn 2026", "vpn рейтинг"],
    ]

    # Этап 1: Сбор вложенных запросов
    print("\n>>> ЭТАП 1: Сбор вложенных запросов из Wordstat")
    all_keywords = collect_nested_keywords(seed_batches)
    print(f"\n>>> Всего собрано уникальных ключей: {len(all_keywords)}")

    # Предварительная фильтрация по базовой частотности
    filtered_for_exact = {k: v for k, v in all_keywords.items() if v >= 30}
    print(f">>> После фильтра base >= 30: {len(filtered_for_exact)}")

    # Этап 2: Сбор точной частотности
    print("\n>>> ЭТАП 2: Сбор точной частотности")
    exact_freq = collect_exact_frequency(filtered_for_exact)
    print(f">>> Точная частотность собрана для {len(exact_freq)} ключей")

    # Этап 3: Фильтрация
    print("\n>>> ЭТАП 3: Фильтрация")
    filtered = filter_keywords(filtered_for_exact, exact_freq)
    print(f">>> После фильтрации: {len(filtered)} ключей")

    # Этап 4: Кластеризация
    print("\n>>> ЭТАП 4: Кластеризация")
    for kw in filtered:
        filtered[kw]['cluster'] = assign_cluster(kw)

    # Сортировка по exact_freq
    sorted_keywords = sorted(filtered.items(), key=lambda x: x[1]['exact_freq'], reverse=True)

    # Вывод результатов
    print("\n" + "=" * 90)
    print(f"{'Ключевое слово':<45} {'Base':>7} {'Exact':>7} {'Int':>4} {'Кластер'}")
    print("-" * 90)

    clusters = defaultdict(list)
    for kw, data in sorted_keywords:
        print(f"{kw:<45} {data['base_freq']:>7} {data['exact_freq']:>7} {data['intent']:>4} {data['cluster']}")
        clusters[data['cluster']].append((kw, data))

    # Сводка по кластерам
    print("\n" + "=" * 60)
    print("СВОДКА ПО КЛАСТЕРАМ")
    print("-" * 60)
    for cluster, items in sorted(clusters.items()):
        total_exact = sum(d['exact_freq'] for _, d in items)
        print(f"\n{cluster} ({len(items)} ключей, total exact: {total_exact})")
        for kw, d in sorted(items, key=lambda x: x[1]['exact_freq'], reverse=True)[:5]:
            print(f"  {kw} — exact: {d['exact_freq']}")
        if len(items) > 5:
            print(f"  ... и ещё {len(items) - 5}")

    # Сохранение в CSV
    csv_path = "/root/vpn-landing/seo/semantic_core.csv"
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Keyword', 'Base Frequency', 'Exact Frequency', 'Intent', 'Cluster'])
        for kw, data in sorted_keywords:
            writer.writerow([kw, data['base_freq'], data['exact_freq'], data['intent'], data['cluster']])

    print(f"\n>>> Результат сохранён: {csv_path}")
    print(f">>> Всего ключей в ядре: {len(sorted_keywords)}")


if __name__ == "__main__":
    main()
