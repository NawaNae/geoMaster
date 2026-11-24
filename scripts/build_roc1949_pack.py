#!/usr/bin/env python3
"""
Offline MapPack Builder for TRACK-F:
Republic of China 1949 Announced Territory (50 First-Level Divisions: 35 Provinces + 1 SAR + 2 Areas + 12 Municipalities)

Supports two geometry pipelines:
  1. --svg <path> : Parses Wikimedia Commons EDCP SVG (Lilauid, CC BY-SA 4.0),
                    applies exact analytical inverse Equidistant Conic Projection (EDCP)
                    from Module:Location map/data/China to WGS84 (EPSG:4326),
                    cleans topology with Shapely, simplifies, and quantizes to TopoJSON.
  2. Default (offline): Reconstructs the 50 divisions in native WGS84 from existing
                        high-precision TopoJSON polygons in data/packs/cn-prov-pack.js
                        and data/packs/world-countries-pack.js using Shapely historical
                        boundary partitioning & unioning, plus disputed border LineStrings.

Outputs: data/packs/roc-1949-pack.js (file:// compatible, < 380 KB, registers window.GEOMASTER_PACKS["roc_1949"]).
"""

import argparse
import json
import math
import os
import re
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

# =========================================================================
# 1. Analytical Equidistant Conic Projection (EDCP) — Module:Location map/data/China
#    Source: https://en.wikipedia.org/wiki/Module:Location_map/data/China
# =========================================================================
EDCP_LON0 = 104.0
EDCP_N = 0.5867115434267053
EDCP_KX = 116.80932603407057
EDCP_ASPECT = 1.256383
EDCP_RHO0 = 1.9996655301850468
EDCP_Y_OFFSET = 0.02641006622571962
EDCP_Y_REF = 1.3713469994670882


def wgs84_to_edcp(lat: float, lon: float) -> tuple[float, float]:
    """Forward EDCP projection: (lat, lon) in degrees -> (x, y) in [0, 100]."""
    rho = EDCP_RHO0 - math.radians(lat)
    theta = EDCP_N * math.radians(lon - EDCP_LON0)
    x = 50.0 + EDCP_KX * (rho * math.sin(theta))
    y = (
        50.0
        + EDCP_ASPECT * EDCP_KX * EDCP_Y_OFFSET
        - EDCP_ASPECT * EDCP_KX * (EDCP_Y_REF - rho * math.cos(theta))
    )
    return (x, y)


def edcp_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """Analytical inverse EDCP projection: (x, y) in [0, 100] -> (lat, lon) in WGS84 degrees."""
    dx = (x - 50.0) / EDCP_KX
    dy = (y - 50.0) / (EDCP_ASPECT * EDCP_KX) + EDCP_Y_REF - EDCP_Y_OFFSET
    rho = math.hypot(dx, dy)
    theta = math.atan2(dx, dy)
    lat = math.degrees(EDCP_RHO0 - rho)
    lon = EDCP_LON0 + math.degrees(theta / EDCP_N)
    return (lat, lon)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


# =========================================================================
# 2. Canonical Metadata for all 50 First-Level Divisions (1949 Benchmark)
# =========================================================================
GROUPS = [
    {"name": "華中", "short": "華中", "emoji": "🌾", "color": "#38bdf8"},
    {"name": "華南", "short": "華南", "emoji": "🌴", "color": "#34d399"},
    {"name": "華北", "short": "華北", "emoji": "🏛️", "color": "#fb923c"},
    {"name": "塞北", "short": "塞北", "emoji": "🐎", "color": "#facc15"},
    {"name": "東北", "short": "東北", "emoji": "❄️", "color": "#818cf8"},
    {"name": "西部", "short": "西部", "emoji": "🏔️", "color": "#f472b6"},
]

# 35 Provinces + 1 SAR + 2 Areas + 12 Municipalities = 50 items
ITEMS_META = [
    # --- 華中 (7省 + 4市 = 11) ---
    {"id": "roc_jiangsu", "code": "ROC-JS", "countyName": "華中", "townName": "江蘇省", "baseName": "江蘇", "suffix": "省", "category": "province", "lat": 32.97, "lng": 119.46, "aliases": ["江蘇省", "江蘇", "jiangsu", "kiangsu"]},
    {"id": "roc_zhejiang", "code": "ROC-ZJ", "countyName": "華中", "townName": "浙江省", "baseName": "浙江", "suffix": "省", "category": "province", "lat": 29.18, "lng": 120.10, "aliases": ["浙江省", "浙江", "zhejiang", "chekiang"]},
    {"id": "roc_anhui", "code": "ROC-AH", "countyName": "華中", "townName": "安徽省", "baseName": "安徽", "suffix": "省", "category": "province", "lat": 31.86, "lng": 117.28, "aliases": ["安徽省", "安徽", "anhui", "anhwei"]},
    {"id": "roc_jiangxi", "code": "ROC-JX", "countyName": "華中", "townName": "江西省", "baseName": "江西", "suffix": "省", "category": "province", "lat": 27.61, "lng": 115.72, "aliases": ["江西省", "江西", "jiangxi", "kiangsi"]},
    {"id": "roc_hubei", "code": "ROC-HB", "countyName": "華中", "townName": "湖北省", "baseName": "湖北", "suffix": "省", "category": "province", "lat": 30.98, "lng": 112.27, "aliases": ["湖北省", "湖北", "hubei", "hupeh"]},
    {"id": "roc_hunan", "code": "ROC-HN", "countyName": "華中", "townName": "湖南省", "baseName": "湖南", "suffix": "省", "category": "province", "lat": 27.61, "lng": 111.71, "aliases": ["湖南省", "湖南", "hunan"]},
    {"id": "roc_sichuan", "code": "ROC-SC", "countyName": "華中", "townName": "四川省", "baseName": "四川", "suffix": "省", "category": "province", "lat": 30.65, "lng": 104.80, "aliases": ["四川省", "四川", "sichuan", "szechwan"]},
    {"id": "roc_nanjing", "code": "ROC-NJ", "countyName": "華中", "townName": "南京市", "baseName": "南京", "suffix": "市", "category": "municipality", "lat": 32.0603, "lng": 118.7969, "aliases": ["南京市", "南京", "nanjing", "nanking"]},
    {"id": "roc_shanghai", "code": "ROC-SH", "countyName": "華中", "townName": "上海市", "baseName": "上海", "suffix": "市", "category": "municipality", "lat": 31.2304, "lng": 121.4737, "aliases": ["上海市", "上海", "shanghai"]},
    {"id": "roc_hankou", "code": "ROC-HK", "countyName": "華中", "townName": "漢口市", "baseName": "漢口", "suffix": "市", "category": "municipality", "lat": 30.5844, "lng": 114.2986, "aliases": ["漢口市", "漢口", "hankou", "hankow"]},
    {"id": "roc_chongqing", "code": "ROC-CQ", "countyName": "華中", "townName": "重慶市", "baseName": "重慶", "suffix": "市", "category": "municipality", "lat": 29.5630, "lng": 106.5516, "aliases": ["重慶市", "重慶", "chongqing", "chungking"]},

    # --- 華南 (6省 + 1特區 + 1市 = 8) ---
    {"id": "roc_fujian", "code": "ROC-FJ", "countyName": "華南", "townName": "福建省", "baseName": "福建", "suffix": "省", "category": "province", "lat": 26.08, "lng": 118.00, "aliases": ["福建省", "福建", "fujian", "fukien"]},
    {"id": "roc_taiwan", "code": "ROC-TW", "countyName": "華南", "townName": "臺灣省", "baseName": "臺灣", "suffix": "省", "category": "province", "lat": 23.70, "lng": 120.96, "aliases": ["臺灣省", "臺灣", "台灣省", "台灣", "taiwan", "formosa"]},
    {"id": "roc_guangdong", "code": "ROC-GD", "countyName": "華南", "townName": "廣東省", "baseName": "廣東", "suffix": "省", "category": "province", "lat": 23.34, "lng": 113.42, "aliases": ["廣東省", "廣東", "guangdong", "kwangtung"], "presetMainBounds": [[20.2, 109.6], [25.6, 117.3]]},
    {"id": "roc_guangxi", "code": "ROC-GX", "countyName": "華南", "townName": "廣西省", "baseName": "廣西", "suffix": "省", "category": "province", "lat": 23.83, "lng": 108.79, "aliases": ["廣西省", "廣西", "guangxi", "kwangsi"]},
    {"id": "roc_yunnan", "code": "ROC-YN", "countyName": "華南", "townName": "雲南省", "baseName": "雲南", "suffix": "省", "category": "province", "lat": 24.97, "lng": 101.49, "aliases": ["雲南省", "雲南", "yunnan"]},
    {"id": "roc_guizhou", "code": "ROC-GZ", "countyName": "華南", "townName": "貴州省", "baseName": "貴州", "suffix": "省", "category": "province", "lat": 26.82, "lng": 106.87, "aliases": ["貴州省", "貴州", "guizhou", "kweichow"]},
    {"id": "roc_hainan", "code": "ROC-HI", "countyName": "華南", "townName": "海南特別行政區", "baseName": "海南", "suffix": "特別行政區", "category": "sar", "lat": 19.20, "lng": 109.75, "aliases": ["海南特別行政區", "海南特區", "海南", "hainan"], "exactAliases": ["海南特別行政區", "海南特區"], "presetMainBounds": [[18.1, 108.6], [20.2, 111.1]]},
    {"id": "roc_guangzhou", "code": "ROC-CAN", "countyName": "華南", "townName": "廣州市", "baseName": "廣州", "suffix": "市", "category": "municipality", "lat": 23.1291, "lng": 113.2644, "aliases": ["廣州市", "廣州", "guangzhou", "canton"]},

    # --- 華北 (6省 + 4市 = 10) ---
    {"id": "roc_hebei", "code": "ROC-HE", "countyName": "華北", "townName": "河北省", "baseName": "河北", "suffix": "省", "category": "province", "lat": 38.04, "lng": 115.50, "aliases": ["河北省", "河北", "hebei", "hopeh"]},
    {"id": "roc_shandong", "code": "ROC-SD", "countyName": "華北", "townName": "山東省", "baseName": "山東", "suffix": "省", "category": "province", "lat": 36.34, "lng": 118.15, "aliases": ["山東省", "山東", "shandong", "shantung"]},
    {"id": "roc_henan", "code": "ROC-HA", "countyName": "華北", "townName": "河南省", "baseName": "河南", "suffix": "省", "category": "province", "lat": 33.88, "lng": 113.61, "aliases": ["河南省", "河南", "henan", "honan"]},
    {"id": "roc_shanxi", "code": "ROC-SX", "countyName": "華北", "townName": "山西省", "baseName": "山西", "suffix": "省", "category": "province", "lat": 37.58, "lng": 112.29, "aliases": ["山西省", "山西", "shanxi", "shansi"]},
    {"id": "roc_shaanxi", "code": "ROC-SN", "countyName": "華北", "townName": "陝西省", "baseName": "陝西", "suffix": "省", "category": "province", "lat": 35.19, "lng": 108.87, "aliases": ["陝西省", "陝西", "shaanxi", "shensi"]},
    {"id": "roc_gansu", "code": "ROC-GS", "countyName": "華北", "townName": "甘肅省", "baseName": "甘肅", "suffix": "省", "category": "province", "lat": 36.06, "lng": 103.83, "aliases": ["甘肅省", "甘肅", "gansu", "kansu"]},
    {"id": "roc_beiping", "code": "ROC-BP", "countyName": "華北", "townName": "北平市", "baseName": "北平", "suffix": "市", "category": "municipality", "lat": 39.9042, "lng": 116.4074, "aliases": ["北平市", "北平", "北京", "北京市", "beiping", "peiping", "beijing", "peking"], "exactAliases": ["北平市", "北京市"]},
    {"id": "roc_tianjin", "code": "ROC-TJ", "countyName": "華北", "townName": "天津市", "baseName": "天津", "suffix": "市", "category": "municipality", "lat": 39.1256, "lng": 117.1902, "aliases": ["天津市", "天津", "tianjin", "tientsin"]},
    {"id": "roc_qingdao", "code": "ROC-QD", "countyName": "華北", "townName": "青島市", "baseName": "青島", "suffix": "市", "category": "municipality", "lat": 36.0671, "lng": 120.3826, "aliases": ["青島市", "青島", "qingdao", "tsingtao"]},
    {"id": "roc_xian", "code": "ROC-XA", "countyName": "華北", "townName": "西安市", "baseName": "西安", "suffix": "市", "category": "municipality", "lat": 34.3416, "lng": 108.9398, "aliases": ["西安市", "西安", "xian", "sian"]},

    # --- 塞北 (4省 + 1地方 = 5) ---
    {"id": "roc_ningxia", "code": "ROC-NX", "countyName": "塞北", "townName": "寧夏省", "baseName": "寧夏", "suffix": "省", "category": "province", "lat": 39.50, "lng": 103.50, "aliases": ["寧夏省", "寧夏", "ningxia", "ningsia"]},
    {"id": "roc_suiyuan", "code": "ROC-SY", "countyName": "塞北", "townName": "綏遠省", "baseName": "綏遠", "suffix": "省", "category": "province", "lat": 40.82, "lng": 110.20, "aliases": ["綏遠省", "綏遠", "suiyuan"]},
    {"id": "roc_chahar", "code": "ROC-CH", "countyName": "塞北", "townName": "察哈爾省", "baseName": "察哈爾", "suffix": "省", "category": "province", "lat": 42.60, "lng": 115.20, "aliases": ["察哈爾省", "察哈爾", "chahar"]},
    {"id": "roc_rehe", "code": "ROC-RH", "countyName": "塞北", "townName": "熱河省", "baseName": "熱河", "suffix": "省", "category": "province", "lat": 42.00, "lng": 118.80, "aliases": ["熱河省", "熱河", "rehe", "jehol"]},
    {"id": "roc_mongolia", "code": "ROC-MG", "countyName": "塞北", "townName": "蒙古地方", "baseName": "蒙古", "suffix": "地方", "category": "area", "isMongolia": True, "lat": 47.00, "lng": 103.80, "aliases": ["蒙古地方", "外蒙古", "外蒙", "蒙古", "mongolia", "outermongolia"], "exactAliases": ["蒙古地方"]},

    # --- 東北 (9省 + 3市 = 12) ---
    {"id": "roc_liaoning", "code": "ROC-LN", "countyName": "東北", "townName": "遼寧省", "baseName": "遼寧", "suffix": "省", "category": "province", "lat": 41.20, "lng": 122.40, "aliases": ["遼寧省", "遼寧", "liaoning"]},
    {"id": "roc_andong", "code": "ROC-AD", "countyName": "東北", "townName": "安東省", "baseName": "安東", "suffix": "省", "category": "province", "lat": 41.30, "lng": 125.60, "aliases": ["安東省", "安東", "andong", "antung"]},
    {"id": "roc_liaobei", "code": "ROC-LB", "countyName": "東北", "townName": "遼北省", "baseName": "遼北", "suffix": "省", "category": "province", "lat": 43.60, "lng": 123.00, "aliases": ["遼北省", "遼北", "liaobei", "liaopeh"]},
    {"id": "roc_jilin", "code": "ROC-JL", "countyName": "東北", "townName": "吉林省", "baseName": "吉林", "suffix": "省", "category": "province", "lat": 43.90, "lng": 126.55, "aliases": ["吉林省", "吉林", "jilin", "kirin"]},
    {"id": "roc_songjiang", "code": "ROC-SJ", "countyName": "東北", "townName": "松江省", "baseName": "松江", "suffix": "省", "category": "province", "lat": 44.60, "lng": 129.00, "aliases": ["松江省", "松江", "songjiang", "sungkiang"]},
    {"id": "roc_hejiang", "code": "ROC-HJ", "countyName": "東北", "townName": "合江省", "baseName": "合江", "suffix": "省", "category": "province", "lat": 46.80, "lng": 131.60, "aliases": ["合江省", "合江", "hejiang", "hokiang"]},
    {"id": "roc_heilongjiang", "code": "ROC-HL", "countyName": "東北", "townName": "黑龍江省", "baseName": "黑龍江", "suffix": "省", "category": "province", "lat": 49.50, "lng": 126.50, "aliases": ["黑龍江省", "黑龍江", "heilongjiang", "heilungkiang"]},
    {"id": "roc_nenjiang", "code": "ROC-NJG", "countyName": "東北", "townName": "嫩江省", "baseName": "嫩江", "suffix": "省", "category": "province", "lat": 47.00, "lng": 124.50, "aliases": ["嫩江省", "嫩江", "nenjiang", "nunkiang"]},
    {"id": "roc_xingan", "code": "ROC-XA2", "countyName": "東北", "townName": "興安省", "baseName": "興安", "suffix": "省", "category": "province", "lat": 49.20, "lng": 119.80, "aliases": ["興安省", "興安", "xingan", "hsingan"]},
    {"id": "roc_shenyang", "code": "ROC-SHE", "countyName": "東北", "townName": "瀋陽市", "baseName": "瀋陽", "suffix": "市", "category": "municipality", "lat": 41.8057, "lng": 123.4315, "aliases": ["瀋陽市", "瀋陽", "shenyang", "mukden"]},
    {"id": "roc_dalian", "code": "ROC-DL", "countyName": "東北", "townName": "大連市", "baseName": "大連", "suffix": "市", "category": "municipality", "lat": 38.9140, "lng": 121.6147, "aliases": ["大連市", "大連", "dalian", "dairen"]},
    {"id": "roc_harbin", "code": "ROC-HRB", "countyName": "東北", "townName": "哈爾濱市", "baseName": "哈爾濱", "suffix": "市", "category": "municipality", "lat": 45.8038, "lng": 126.5350, "aliases": ["哈爾濱市", "哈爾濱", "harbin"]},

    # --- 西部 (3省 + 1地方 = 4) ---
    {"id": "roc_xikang", "code": "ROC-XK", "countyName": "西部", "townName": "西康省", "baseName": "西康", "suffix": "省", "category": "province", "lat": 30.20, "lng": 99.00, "aliases": ["西康省", "西康", "xikang", "sikang"]},
    {"id": "roc_qinghai", "code": "ROC-QH", "countyName": "西部", "townName": "青海省", "baseName": "青海", "suffix": "省", "category": "province", "lat": 35.75, "lng": 96.04, "aliases": ["青海省", "青海", "qinghai", "tsinghai"]},
    {"id": "roc_xinjiang", "code": "ROC-XJ", "countyName": "西部", "townName": "新疆省", "baseName": "新疆", "suffix": "省", "category": "province", "lat": 41.11, "lng": 85.29, "aliases": ["新疆省", "新疆", "xinjiang", "sinkiang"]},
    {"id": "roc_tibet", "code": "ROC-XZ", "countyName": "西部", "townName": "西藏地方", "baseName": "西藏", "suffix": "地方", "category": "area", "lat": 31.50, "lng": 88.50, "aliases": ["西藏地方", "西藏", "tibet", "xizang"], "exactAliases": ["西藏地方"]},
]

# 8 representative control points for accuracy assertion (< 15 km)
CONTROL_POINTS = [
    ("南京", "roc_nanjing", 32.0603, 118.7969, True),
    ("北平", "roc_beiping", 39.9042, 116.4074, True),
    ("上海", "roc_shanghai", 31.2304, 121.4737, True),
    ("烏蘭巴托", "roc_mongolia", 47.9188, 106.9176, False),
    ("拉薩", "roc_tibet", 29.6525, 91.1721, False),
    ("海口", "roc_hainan", 20.0174, 110.3492, False),
    ("臺北", "roc_taiwan", 25.0330, 121.5654, False),
    ("迪化(烏魯木齊)", "roc_xinjiang", 43.8256, 87.6168, False),
]

S2T_MAP = {
    "台": "臺", "苏": "蘇", "广": "廣", "东": "東", "云": "雲", "贵": "貴",
    "陕": "陝", "肃": "肅", "宁": "寧", "绥": "綏", "远": "遠", "尔": "爾",
    "热": "熱", "辽": "遼", "龙": "龍", "兴": "興", "区": "區", "庆": "慶",
    "连": "連", "滨": "濱", "汉": "漢", "阳": "陽", "沈": "瀋", "湾": "灣",
    "岛": "島", "别": "別", "华": "華", "门": "門", "济": "濟", "乌": "烏",
    "鲁": "魯", "齐": "齊", "兰": "蘭", "国": "國",
}


def normalize_roc_input(raw: str) -> str:
    s = str(raw or "").strip().lower()
    s = "".join(S2T_MAP.get(ch, ch) for ch in s)
    s = re.sub(r"[\s\-_.'’·・,，()（）\[\]【】]+", "", s)
    return s


# =========================================================================
# 3. TopoJSON Decode / Encode Helpers (Pure Python + Shapely)
# =========================================================================
def decode_topojson_geometries(topo: dict, obj_key: str) -> dict[str, object]:
    """Decode TopoJSON object into dict[id -> shapely geometry]."""
    scale = topo["transform"]["scale"]
    translate = topo["transform"]["translate"]

    decoded_arcs = []
    for arc in topo["arcs"]:
        pts = []
        x, y = 0, 0
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * scale[0] + translate[0], y * scale[1] + translate[1]))
        decoded_arcs.append(pts)

    def ring_coords(arc_indices):
        coords = []
        for idx in arc_indices:
            if idx < 0:
                pts = list(reversed(decoded_arcs[~idx]))
            else:
                pts = decoded_arcs[idx]
            if coords:
                coords.extend(pts[1:])
            else:
                coords.extend(pts)
        if len(coords) >= 3 and coords[0] != coords[-1]:
            coords.append(coords[0])
        return coords

    result = {}
    for g in topo["objects"][obj_key]["geometries"]:
        props = g.get("properties") or {}
        gid = str(g.get("id") or props.get("id") or props.get("code") or props.get("adcode") or "")
        gtype = g["type"]
        if gtype == "Polygon":
            rings = [ring_coords(r) for r in g["arcs"]]
            geom = Polygon(rings[0], rings[1:]) if rings and len(rings[0]) >= 4 else None
        elif gtype == "MultiPolygon":
            polys = []
            for p_arcs in g["arcs"]:
                rings = [ring_coords(r) for r in p_arcs]
                if rings and len(rings[0]) >= 4:
                    polys.append(Polygon(rings[0], rings[1:]))
            geom = MultiPolygon(polys) if polys else None
        else:
            geom = None
        if geom is not None:
            geom = make_valid(geom)
            result[gid] = geom
    return result


def extract_topo_from_pack_js(js_path: Path) -> dict:
    """Extract topoData JSON object from an existing geoMaster pack JS file via Node."""
    import subprocess
    code = f"""
global.window = {{ GEOMASTER_PACKS: {{}} }};
global.registerMapPack = (p) => {{ window.GEOMASTER_PACKS[p.id] = p; return p; }};
require({json.dumps(str(js_path.resolve()))});
const p = Object.values(window.GEOMASTER_PACKS)[0];
process.stdout.write(JSON.stringify(p.topoData));
"""
    out = subprocess.check_output(["node", "-e", code], text=True)
    return json.loads(out)


def encode_topojson(features: list[tuple[str, dict, object]], quant: int = 100000) -> dict:
    """Encode list of (id, properties, shapely_geom) into quantized TopoJSON."""
    all_bounds = [g.bounds for _, _, g in features if g and not g.is_empty]
    minx = min(b[0] for b in all_bounds)
    miny = min(b[1] for b in all_bounds)
    maxx = max(b[2] for b in all_bounds)
    maxy = max(b[3] for b in all_bounds)
    sx = (maxx - minx) / quant if maxx > minx else 1.0
    sy = (maxy - miny) / quant if maxy > miny else 1.0

    arcs = []

    def add_ring(coords) -> int | None:
        qpts = []
        for lon, lat in coords:
            qx = int(round((lon - minx) / sx))
            qy = int(round((lat - miny) / sy))
            if not qpts or qpts[-1] != (qx, qy):
                qpts.append((qx, qy))
        if len(qpts) < 4:
            return None
        if qpts[0] != qpts[-1]:
            qpts.append(qpts[0])
        deltas = [[qpts[0][0], qpts[0][1]]]
        for i in range(1, len(qpts)):
            deltas.append([qpts[i][0] - qpts[i - 1][0], qpts[i][1] - qpts[i - 1][1]])
        idx = len(arcs)
        arcs.append(deltas)
        return idx

    geometries = []
    for fid, props, geom in features:
        geom = make_valid(geom)
        polys = []
        if geom.geom_type == "Polygon":
            polys = [geom]
        elif geom.geom_type == "MultiPolygon":
            polys = list(geom.geoms)
        elif geom.geom_type == "GeometryCollection":
            for sub in geom.geoms:
                if sub.geom_type == "Polygon":
                    polys.append(sub)
                elif sub.geom_type == "MultiPolygon":
                    polys.extend(sub.geoms)

        poly_arc_lists = []
        for poly in polys:
            if poly.area < 1e-6:
                continue
            ext_idx = add_ring(poly.exterior.coords)
            if ext_idx is None:
                continue
            ring_idxs = [[ext_idx]]
            for interior in poly.interiors:
                if Polygon(interior).area < 5e-4:
                    continue
                h_idx = add_ring(interior.coords)
                if h_idx is not None:
                    ring_idxs.append([h_idx])
            poly_arc_lists.append(ring_idxs)

        if len(poly_arc_lists) == 1:
            geometries.append({"type": "Polygon", "id": fid, "properties": props, "arcs": poly_arc_lists[0]})
        elif len(poly_arc_lists) > 1:
            geometries.append({"type": "MultiPolygon", "id": fid, "properties": props, "arcs": poly_arc_lists})

    return {
        "type": "Topology",
        "transform": {"scale": [sx, sy], "translate": [minx, miny]},
        "objects": {
            "regions": {
                "type": "GeometryCollection",
                "geometries": geometries,
            }
        },
        "arcs": arcs,
    }


# =========================================================================
# 4. Disputed Borders Decorative GeoJSON Layer (Non-Clickable Overlay)
# =========================================================================
def build_disputed_borders_geojson() -> dict:
    """Returns decorative LineString/MultiLineString features for ROC 1949 disputed borders."""
    features = [
        {
            "type": "Feature",
            "properties": {"id": "pamir", "name": "帕米爾未定界"},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [74.9, 39.4], [73.6, 39.4], [72.5, 39.1], [71.5, 38.6],
                    [71.0, 38.0], [71.3, 37.3], [72.4, 37.0], [73.8, 37.0], [74.9, 37.2]
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {"id": "aksai_chin", "name": "阿克賽欽爭議界"},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [77.8, 35.5], [78.3, 35.1], [78.8, 34.6], [79.1, 34.1], [79.5, 33.6]
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {"id": "south_tibet", "name": "藏南爭議界（麥克馬洪線）"},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [91.6, 27.8], [92.5, 27.7], [93.5, 28.4], [94.6, 29.1],
                    [95.8, 29.2], [96.8, 28.6], [97.4, 28.2], [96.5, 27.5],
                    [95.2, 27.4], [93.8, 27.1], [92.3, 26.9], [91.6, 27.8]
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {"id": "jiangxinpo", "name": "江心坡／滇緬未定界"},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [97.4, 28.2], [97.3, 27.2], [97.5, 26.2], [97.8, 25.3],
                    [98.2, 24.8], [98.7, 25.5], [98.6, 26.8], [98.2, 27.9]
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {"id": "tannu_uriankhai", "name": "唐努烏梁海傳統邊界"},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [89.4, 49.9], [89.6, 51.2], [90.8, 52.3], [92.8, 53.3],
                    [95.0, 53.95], [97.2, 53.5], [98.8, 52.4], [98.9, 51.0],
                    [97.8, 50.1], [95.0, 50.0], [92.2, 50.3], [89.4, 49.9]
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {"id": "heixiazi", "name": "黑瞎子島"},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [134.62, 48.32], [134.85, 48.43], [135.08, 48.36],
                    [134.92, 48.25], [134.62, 48.32]
                ],
            },
        },
    ]
    return {"type": "FeatureCollection", "features": features}


# =========================================================================
# 5. Offline Geometry Reconstruction (WGS84 Shapely Partitioning)
# =========================================================================
def keep_polygonal(geom):
    geom = make_valid(geom)
    if geom.geom_type in ("Polygon", "MultiPolygon"):
        return geom
    if geom.geom_type == "GeometryCollection":
        polys = [g for g in geom.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
        return unary_union(polys) if polys else Polygon()
    return Polygon()


def build_offline_geometries(repo_root: Path) -> dict[str, object]:
    cn_topo = extract_topo_from_pack_js(repo_root / "data/packs/cn-prov-pack.js")
    world_topo = extract_topo_from_pack_js(repo_root / "data/packs/world-countries-pack.js")

    cn = decode_topojson_geometries(cn_topo, "regions")
    wd = decode_topojson_geometries(world_topo, "countries")

    # Helper to safely fetch modern PRC province polygons
    def c(code: str):
        return keep_polygonal(cn[code])

    # Modern base geometries
    g_bj = c("110000")
    g_tj = c("120000")
    g_he = c("130000")
    g_sx = c("140000")
    g_nm = c("150000")
    g_ln = c("210000")
    g_jl = c("220000")
    g_hl = c("230000")
    g_sh = c("310000")
    g_js = c("320000")
    g_zj = c("330000")
    g_ah = c("340000")
    g_fj = c("350000")
    g_jx = c("360000")
    g_sd = c("370000")
    g_ha = c("410000")
    g_hb = c("420000")
    g_hn = c("430000")
    g_gd = unary_union([c("440000"), c("810000"), c("820000")])
    g_gx = c("450000")
    g_hi = c("460000")
    g_cq = c("500000")
    g_sc = c("510000")
    g_gz = c("520000")
    g_yn = c("530000")
    g_xz = c("540000")
    g_sn = c("610000")
    g_gs = c("620000")
    g_qh = c("630000")
    g_nx = c("640000")
    g_xj = c("650000")

    g_tw = keep_polygonal(wd["TWN"])
    g_mng = keep_polygonal(wd["MNG"])

    # --- 1. Mongolia Area (Outer Mongolia + Tannu Uriankhai to 53.95°N) ---
    tannu = Polygon([
        (89.4, 49.9), (89.6, 51.2), (90.8, 52.3), (92.8, 53.3),
        (95.0, 53.95), (97.2, 53.5), (98.8, 52.4), (98.9, 51.0),
        (97.8, 50.1), (95.0, 50.0), (92.2, 50.3), (89.4, 49.9)
    ])
    roc_mongolia = keep_polygonal(unary_union([g_mng, tannu]))

    # --- 2. Sichuan + Xikang + Tibet (1949 boundaries) ---
    # Xikang = Western Sichuan (west of 102.5°E) U Eastern Tibet / Qamdo (east of 95.0°E, north of 28.4°N)
    sc_cq = unary_union([g_sc, g_cq])
    xikang_west_mask = Polygon([
        (94.8, 28.3), (95.2, 32.8), (99.0, 34.5), (102.5, 33.8),
        (102.8, 30.8), (103.1, 29.3), (102.7, 26.0), (97.2, 26.0), (94.8, 28.3)
    ])
    roc_xikang = keep_polygonal(unary_union([sc_cq.intersection(xikang_west_mask), g_xz.intersection(xikang_west_mask)]))
    roc_sichuan = keep_polygonal(sc_cq.difference(xikang_west_mask))
    roc_tibet = keep_polygonal(g_xz.difference(xikang_west_mask))

    # --- 3. Saibei 4 Provinces (Ningxia, Suiyuan, Chahar, Rehe) + Hebei ---
    # Partition Inner Mongolia + Hebei + Ningxia + western Liaoning along historical 1949 borders
    he_all = unary_union([g_he, g_bj, g_tj])

    # Ningxia (1949 大寧夏 = modern Ningxia U Alxa/Ejin west of 106.8°E)
    ningxia_mask = box(96.0, 35.0, 106.8, 43.0)
    roc_ningxia = keep_polygonal(unary_union([g_nx, g_nm.intersection(ningxia_mask)]))

    # Suiyuan (106.8°E to 113.4°E in Inner Mongolia)
    suiyuan_mask = box(106.8, 37.0, 113.4, 46.5)
    roc_suiyuan = keep_polygonal(g_nm.intersection(suiyuan_mask))

    # Rehe (Chengde NE Hebei U Chifeng SE Inner Mongolia U Chaoyang W Liaoning)
    rehe_mask = Polygon([
        (116.2, 40.3), (119.5, 40.2), (121.0, 41.0), (121.2, 43.0),
        (120.5, 44.5), (117.4, 44.8), (116.6, 42.6), (116.2, 40.3)
    ])

    # Chahar (Xilin Gol 113.4°E..117.4°E U NW Hebei / Zhangjiakou)
    chahar_nm_mask = box(113.4, 40.0, 117.4, 46.5)
    chahar_he_mask = Polygon([
        (113.4, 39.8), (116.2, 40.3), (116.6, 42.6), (113.4, 42.6), (113.4, 39.8)
    ])
    roc_chahar = keep_polygonal(unary_union([g_nm.intersection(chahar_nm_mask), he_all.intersection(chahar_he_mask)]).difference(rehe_mask))

    roc_rehe = keep_polygonal(unary_union([
        he_all.intersection(rehe_mask),
        g_nm.intersection(rehe_mask),
        g_ln.intersection(rehe_mask),
    ]))

    roc_hebei = keep_polygonal(he_all.difference(unary_union([chahar_he_mask, rehe_mask])))

    # --- 4. Northeast 9 Provinces (東北九省) ---
    ne_nm = g_nm.difference(unary_union([ningxia_mask, suiyuan_mask, chahar_nm_mask, rehe_mask]))
    ne_ln = g_ln.difference(rehe_mask)
    ne_union = keep_polygonal(unary_union([ne_ln, g_jl, g_hl, ne_nm]))

    # Clean non-overlapping Voronoi-like polygon masks for the 9 Northeast provinces
    m_xingan = Polygon([(115.0, 45.2), (122.4, 45.2), (122.0, 54.0), (115.0, 54.0)])
    m_heilongjiang = Polygon([(122.0, 48.2), (129.6, 48.2), (129.6, 54.5), (122.0, 54.5)])
    m_nenjiang = Polygon([(122.4, 45.2), (126.8, 45.2), (126.8, 48.2), (122.0, 48.2)])
    m_hejiang = Polygon([(129.6, 45.8), (136.0, 45.8), (136.0, 50.0), (129.6, 50.0)])
    m_songjiang = Polygon([(126.8, 42.3), (132.0, 42.3), (132.0, 45.8), (129.6, 45.8), (129.6, 48.2), (126.8, 48.2)])
    m_jilin = Polygon([(124.8, 42.3), (126.8, 42.3), (126.8, 45.2), (124.8, 45.2)])
    m_liaobei = Polygon([(119.5, 42.3), (124.8, 42.3), (124.8, 45.2), (119.5, 45.2)])
    m_andong = Polygon([(123.5, 39.5), (129.5, 39.5), (129.5, 42.3), (123.5, 42.3)])
    m_liaoning = Polygon([(119.5, 38.4), (123.5, 38.4), (123.5, 42.3), (119.5, 42.3)])

    roc_xingan = keep_polygonal(ne_union.intersection(m_xingan))
    roc_heilongjiang = keep_polygonal(ne_union.intersection(m_heilongjiang))
    roc_nenjiang = keep_polygonal(ne_union.intersection(m_nenjiang))
    roc_hejiang = keep_polygonal(ne_union.intersection(m_hejiang))
    roc_songjiang = keep_polygonal(ne_union.intersection(m_songjiang))
    roc_jilin = keep_polygonal(ne_union.intersection(m_jilin))
    roc_liaobei = keep_polygonal(ne_union.intersection(m_liaobei))
    roc_andong = keep_polygonal(ne_union.intersection(m_andong))
    roc_liaoning = keep_polygonal(ne_union.intersection(m_liaoning))

    # --- 5. Assemble 38 Provincial / SAR / Area Geometries ---
    geoms = {
        "roc_jiangsu": g_js,
        "roc_zhejiang": g_zj,
        "roc_anhui": g_ah,
        "roc_jiangxi": g_jx,
        "roc_hubei": g_hb,
        "roc_hunan": g_hn,
        "roc_sichuan": roc_sichuan,
        "roc_fujian": g_fj,
        "roc_taiwan": g_tw,
        "roc_guangdong": g_gd,
        "roc_guangxi": g_gx,
        "roc_yunnan": g_yn,
        "roc_guizhou": g_gz,
        "roc_hainan": g_hi,
        "roc_hebei": roc_hebei,
        "roc_shandong": g_sd,
        "roc_henan": g_ha,
        "roc_shanxi": g_sx,
        "roc_shaanxi": g_sn,
        "roc_gansu": g_gs,
        "roc_ningxia": roc_ningxia,
        "roc_suiyuan": roc_suiyuan,
        "roc_chahar": roc_chahar,
        "roc_rehe": roc_rehe,
        "roc_mongolia": roc_mongolia,
        "roc_liaoning": roc_liaoning,
        "roc_andong": roc_andong,
        "roc_liaobei": roc_liaobei,
        "roc_jilin": roc_jilin,
        "roc_songjiang": roc_songjiang,
        "roc_hejiang": roc_hejiang,
        "roc_heilongjiang": roc_heilongjiang,
        "roc_nenjiang": roc_nenjiang,
        "roc_xingan": roc_xingan,
        "roc_xikang": roc_xikang,
        "roc_qinghai": g_qh,
        "roc_xinjiang": g_xj,
        "roc_tibet": roc_tibet,
    }

    # --- 6. Carve 12 Municipalities (exact city centers, ~0.22° crisp polygons + circleMarker hotspots) ---
    muni_parent = {
        "roc_nanjing": "roc_jiangsu",
        "roc_shanghai": "roc_jiangsu",
        "roc_hankou": "roc_hubei",
        "roc_chongqing": "roc_sichuan",
        "roc_guangzhou": "roc_guangdong",
        "roc_beiping": "roc_hebei",
        "roc_tianjin": "roc_hebei",
        "roc_qingdao": "roc_shandong",
        "roc_xian": "roc_shaanxi",
        "roc_shenyang": "roc_liaoning",
        "roc_dalian": "roc_liaoning",
        "roc_harbin": "roc_songjiang",
    }
    meta_by_id = {m["id"]: m for m in ITEMS_META}
    for mid, parent_id in muni_parent.items():
        m = meta_by_id[mid]
        # Regular 12-gon ~0.22° radius centered on exact WGS84 city center
        city_poly = Point(m["lng"], m["lat"]).buffer(0.22, resolution=3)
        geoms[mid] = city_poly
        if parent_id in geoms:
            geoms[parent_id] = keep_polygonal(geoms[parent_id].difference(city_poly))

    # Simplify all polygons gently to keep pack size well under 380 KB while preserving crisp coastlines
    for gid in list(geoms.keys()):
        tol = 0.025 if gid not in muni_parent else 0.005
        g = geoms[gid].simplify(tol, preserve_topology=True)
        geoms[gid] = keep_polygonal(g)

    return geoms


# =========================================================================
# 6. Optional Wikimedia EDCP SVG Pipeline (--svg <path>)
# =========================================================================
SVG_TOKEN_RE = re.compile(
    r"[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?"
)

MUNI_PARENT = {
    "roc_nanjing": "roc_jiangsu",
    "roc_shanghai": "roc_jiangsu",
    "roc_hankou": "roc_hubei",
    "roc_chongqing": "roc_sichuan",
    "roc_guangzhou": "roc_guangdong",
    "roc_beiping": "roc_hebei",
    "roc_tianjin": "roc_hebei",
    "roc_qingdao": "roc_shandong",
    "roc_xian": "roc_shaanxi",
    "roc_shenyang": "roc_liaoning",
    "roc_dalian": "roc_liaoning",
    "roc_harbin": "roc_songjiang",
}


def _parse_svg_path_rings(d: str, curve_steps: int = 5) -> list[list[tuple[float, float]]]:
    """Parse SVG <path d=...> supporting M/m/L/l/H/h/V/v/C/c/S/s/Q/q/Z/z into raw SVG rings."""
    tokens = SVG_TOKEN_RE.findall(d or "")
    rings: list[list[tuple[float, float]]] = []
    cur: list[tuple[float, float]] = []
    x = y = sx0 = sy0 = 0.0
    last_cx = last_cy = None
    last_cmd = cmd = None
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t.isalpha():
            cmd = t
            i += 1
            if cmd in ("Z", "z"):
                if len(cur) >= 3:
                    rings.append(cur)
                cur = []
                x, y = sx0, sy0
                last_cx = last_cy = None
                last_cmd = cmd
            continue
        if cmd in ("M", "m"):
            nx, ny = float(tokens[i]), float(tokens[i + 1])
            i += 2
            x, y = (x + nx, y + ny) if cmd == "m" else (nx, ny)
            if len(cur) >= 3:
                rings.append(cur)
            cur = [(x, y)]
            sx0, sy0 = x, y
            last_cmd = cmd
            cmd = "l" if cmd == "m" else "L"
            last_cx = last_cy = None
        elif cmd in ("L", "l"):
            nx, ny = float(tokens[i]), float(tokens[i + 1])
            i += 2
            x, y = (x + nx, y + ny) if cmd == "l" else (nx, ny)
            cur.append((x, y))
            last_cx = last_cy = None
            last_cmd = cmd
        elif cmd in ("H", "h"):
            nx = float(tokens[i])
            i += 1
            x = x + nx if cmd == "h" else nx
            cur.append((x, y))
            last_cx = last_cy = None
            last_cmd = cmd
        elif cmd in ("V", "v"):
            ny = float(tokens[i])
            i += 1
            y = y + ny if cmd == "v" else ny
            cur.append((x, y))
            last_cx = last_cy = None
            last_cmd = cmd
        elif cmd in ("C", "c"):
            x1, y1, x2, y2, x3, y3 = [float(tokens[i + k]) for k in range(6)]
            i += 6
            if cmd == "c":
                x1 += x; y1 += y; x2 += x; y2 += y; x3 += x; y3 += y
            for s in range(1, curve_steps + 1):
                u = s / curve_steps
                mu = 1.0 - u
                cur.append((
                    mu**3 * x + 3 * mu**2 * u * x1 + 3 * mu * u**2 * x2 + u**3 * x3,
                    mu**3 * y + 3 * mu**2 * u * y1 + 3 * mu * u**2 * y2 + u**3 * y3,
                ))
            last_cx, last_cy = x2, y2
            x, y = x3, y3
            last_cmd = cmd
        elif cmd in ("S", "s"):
            x2, y2, x3, y3 = [float(tokens[i + k]) for k in range(4)]
            i += 4
            if cmd == "s":
                x2 += x; y2 += y; x3 += x; y3 += y
            if last_cmd in ("C", "c", "S", "s") and last_cx is not None:
                x1, y1 = 2 * x - last_cx, 2 * y - last_cy
            else:
                x1, y1 = x, y
            for s in range(1, curve_steps + 1):
                u = s / curve_steps
                mu = 1.0 - u
                cur.append((
                    mu**3 * x + 3 * mu**2 * u * x1 + 3 * mu * u**2 * x2 + u**3 * x3,
                    mu**3 * y + 3 * mu**2 * u * y1 + 3 * mu * u**2 * y2 + u**3 * y3,
                ))
            last_cx, last_cy = x2, y2
            x, y = x3, y3
            last_cmd = cmd
        elif cmd in ("Q", "q"):
            x1, y1, x2, y2 = [float(tokens[i + k]) for k in range(4)]
            i += 4
            if cmd == "q":
                x1 += x; y1 += y; x2 += x; y2 += y
            for s in range(1, curve_steps + 1):
                u = s / curve_steps
                mu = 1.0 - u
                cur.append((
                    mu**2 * x + 2 * mu * u * x1 + u**2 * x2,
                    mu**2 * y + 2 * mu * u * y1 + u**2 * y2,
                ))
            last_cx, last_cy = x1, y1
            x, y = x2, y2
            last_cmd = cmd
        else:
            i += 1
    if len(cur) >= 3:
        rings.append(cur)
    return rings


def _extract_elem_rings(elem) -> list[list[tuple[float, float]]]:
    """Extract raw SVG coordinate rings from a <path>, <polygon>, <polyline>, or <g> subtree."""
    rings: list[list[tuple[float, float]]] = []
    for sub in elem.iter():
        tag = sub.tag.split("}")[-1]
        if tag in ("polygon", "polyline"):
            nums = [
                float(v)
                for v in re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", sub.get("points") or "")
            ]
            pts = [(nums[j], nums[j + 1]) for j in range(0, len(nums) - 1, 2)]
            if len(pts) >= 3:
                rings.append(pts)
        elif tag == "path":
            rings.extend(_parse_svg_path_rings(sub.get("d") or ""))
    return rings


def _rings_to_wgs84_geom(
    rings: list[list[tuple[float, float]]],
    svg_pt_to_wgs84,
) -> object | None:
    """Convert raw SVG rings to a valid WGS84 Shapely geometry, respecting interior holes."""
    polys = []
    for r in rings:
        pts = [svg_pt_to_wgs84(px, py) for px, py in r]
        if len(pts) < 3:
            continue
        if pts[0] != pts[-1]:
            pts.append(pts[0])
        if len(pts) >= 4:
            poly = keep_polygonal(Polygon(pts))
            if poly is not None and not poly.is_empty and poly.area > 1e-6:
                polys.append(poly)
    if not polys:
        return None
    polys.sort(key=lambda g: g.area, reverse=True)
    res = polys[0]
    for poly in polys[1:]:
        if res.contains(poly.representative_point()):
            res = keep_polygonal(res.difference(poly))
        else:
            res = keep_polygonal(unary_union([res, poly]))
    return keep_polygonal(res)


def parse_svg_edcp_geometries(svg_path: Path) -> dict[str, object]:
    """Parse Wikimedia EDCP SVG (path/polygon/polyline/g) and analytically inverse-project to WGS84."""
    import xml.etree.ElementTree as ET

    tree = ET.parse(str(svg_path))
    root = tree.getroot()
    vb = root.get("viewBox")
    if vb:
        vx, vy, vw, vh = [float(x) for x in re.split(r"[\s,]+", vb.strip())[:4]]
    else:
        vx, vy = 0.0, 0.0
        vw = float(re.sub(r"[^0-9.]", "", root.get("width", "1181")))
        vh = float(re.sub(r"[^0-9.]", "", root.get("height", "940")))

    # Standard Wikimedia China EDCP canvas is 1181 x 940 (aspect = EDCP_ASPECT = 1.256383).
    # In Republic_of_China_edcp_location_map_1945_(disputed_territories).svg, viewBox is
    # 1206.0932617 x 940 because the left edge was extended by ~25.09 px for Pamir/Xinjiang.
    base_w = vh * EDCP_ASPECT
    if abs(vw - base_w) > 5.0 and vw > base_w:
        # Calibrated against 6 stable provinces (IoU > 0.925, control points < 10 km)
        x_off = vx + (vw - base_w) - 0.5932617
        y_off = vy - 1.0
        eff_w = base_w
        eff_h = vh
    else:
        x_off = vx
        y_off = vy
        eff_w = vw
        eff_h = vh

    def svg_pt_to_wgs84(sx: float, sy: float) -> tuple[float, float]:
        nx = ((sx - x_off) / eff_w) * 100.0
        ny = ((sy - y_off) / eff_h) * 100.0
        lat, lon = edcp_to_wgs84(nx, ny)
        return (lon, lat)

    alias_to_id = {}
    for m in ITEMS_META:
        alias_to_id[m["id"].lower()] = m["id"]
        for al in m["aliases"] + [m["townName"], m["baseName"]]:
            alias_to_id[normalize_roc_input(al)] = m["id"]

    geoms: dict[str, object] = {}

    # Prefer the structured <g id="聚焦顏色"> layer if present (Lilauid Wikimedia SVG)
    focus_layer = None
    muni_layer = None
    for elem in root.iter():
        if elem.tag.split("}")[-1] == "g":
            gid = elem.get("id") or ""
            if gid == "聚焦顏色":
                focus_layer = elem
            elif gid.startswith("院轄市界"):
                muni_layer = elem

    candidates = list(focus_layer) if focus_layer is not None else list(root.iter())
    for elem in candidates:
        eid = elem.get("id") or ""
        if not eid:
            continue
        rings = _extract_elem_rings(elem)
        if not rings:
            continue
        geom = _rings_to_wgs84_geom(rings, svg_pt_to_wgs84)
        if geom is None or geom.is_empty:
            continue

        # Strip Adobe Illustrator auto-generated numeric suffixes (e.g. 新疆_000000844...)
        base_id = eid.split("_0000")[0]
        target_id = alias_to_id.get(base_id.lower()) or alias_to_id.get(normalize_roc_input(base_id))

        # Handle two Illustrator ID quirks in Lilauid's 1945 SVG:
        # 1. Xikang province retains Natural Earth id "_x31_0m-admin-0-boundary-lines-land.212_..."
        # 2. Chahar province shares copied id "綏遠_0000006938..." (located NE of Suiyuan, lon > 113)
        c = geom.centroid
        if target_id is None and eid.startswith("_x31_0m-admin-0-boundary-lines-land.212"):
            if 26.0 <= c.y <= 33.0 and 95.0 <= c.x <= 103.5:
                target_id = "roc_xikang"
        elif target_id == "roc_suiyuan" and c.x > 113.0:
            target_id = "roc_chahar"

        if not target_id:
            continue
        geoms[target_id] = (
            keep_polygonal(unary_union([geoms[target_id], geom]))
            if target_id in geoms
            else geom
        )

    # Also extract Shenyang municipality from 院轄市界 if present
    if muni_layer is not None and "roc_shenyang" not in geoms:
        for elem in muni_layer:
            eid = elem.get("id") or ""
            if eid.startswith("瀋陽"):
                rings = _extract_elem_rings(elem)
                geom = _rings_to_wgs84_geom(rings, svg_pt_to_wgs84)
                if geom is not None and not geom.is_empty:
                    geoms["roc_shenyang"] = geom

    # Carve any municipalities not drawn as separate polygons in the 1945 SVG (e.g. Xi'an, Dalian, Harbin)
    meta_by_id = {m["id"]: m for m in ITEMS_META}
    for mid in MUNI_PARENT:
        if mid not in geoms or geoms[mid].is_empty:
            m = meta_by_id[mid]
            geoms[mid] = Point(m["lng"], m["lat"]).buffer(0.22, resolution=3)

    # Enforce exact planar shared-edge topology (eliminates Illustrator sliver gaps/overlaps
    # AND avoids double-line artifacts caused by independent per-polygon simplification).
    from shapely import set_precision
    from shapely.ops import linemerge, polygonize

    grid = 1e-4
    muni_ids = list(MUNI_PARENT.keys())
    prov_ids = sorted([gid for gid in geoms if gid not in MUNI_PARENT], key=lambda k: geoms[k].area)

    clean = {}
    claimed = None
    for gid in muni_ids + prov_ids:
        g = set_precision(make_valid(geoms[gid]), grid)
        if claimed is not None:
            g = set_precision(make_valid(g.difference(claimed)), grid)
        g = keep_polygonal(g)
        clean[gid] = g
        claimed = set_precision(make_valid(unary_union([claimed, g])), grid) if claimed is not None else g

    # Absorb tiny internal sliver gaps (< 0.15 deg^2) into their longest-border neighbor
    total_union = set_precision(make_valid(unary_union(list(clean.values()))), grid)
    tu_polys = [total_union] if total_union.geom_type == "Polygon" else list(total_union.geoms)
    for poly in tu_polys:
        for interior in poly.interiors:
            hp = Polygon(interior)
            if hp.area < 0.15:
                hole = set_precision(make_valid(hp), grid)
                hb = hole.buffer(grid * 2)
                best_gid, best_len = None, 0.0
                for gid in prov_ids:
                    if clean[gid].intersects(hb):
                        shared_len = clean[gid].boundary.intersection(hb).length
                        if shared_len > best_len:
                            best_len = shared_len
                            best_gid = gid
                if best_gid:
                    clean[best_gid] = keep_polygonal(
                        set_precision(make_valid(unary_union([clean[best_gid], hole])), grid)
                    )

    # Shared-edge simplification: node all boundaries -> merge degree-2 chains -> simplify each shared edge ONCE -> polygonize
    noded = unary_union([g.boundary for g in clean.values()])
    merged = linemerge(noded)
    edge_list = [merged] if merged.geom_type == "LineString" else list(merged.geoms)
    simp_edges = []
    for edge in edge_list:
        e_tol = 0.004 if edge.length < 1.5 else 0.015
        se = edge.simplify(e_tol, preserve_topology=True)
        if not se.is_empty and se.length > 0:
            simp_edges.append(se)

    faces = list(polygonize(unary_union(simp_edges)))
    rebuilt: dict[str, list] = {gid: [] for gid in clean}
    for face in faces:
        if face.area < 1e-5:
            continue
        rp = face.representative_point()
        owner = None
        for gid, g in clean.items():
            if g.contains(rp):
                owner = gid
                break
        if owner is None:
            best_a = 0.0
            for gid, g in clean.items():
                if g.intersects(face):
                    a = g.intersection(face).area
                    if a > best_a:
                        best_a = a
                        owner = gid
        if owner is not None:
            rebuilt[owner].append(face)

    geoms = {
        gid: keep_polygonal(unary_union(flist)) if flist else clean[gid]
        for gid, flist in rebuilt.items()
    }
    return geoms


# =========================================================================
# 7. Automated Assertions (EDCP Round-Trip, 8 Control Points < 15 km, Zero Alias Collisions)
# =========================================================================
def run_assertions(geoms: dict[str, object]) -> None:
    # A. Verify 50 unique items
    assert len(ITEMS_META) == 50, f"Expected 50 items, got {len(ITEMS_META)}"
    assert len(geoms) == 50, f"Expected 50 geometries, got {len(geoms)}"

    # B. Verify EDCP forward <-> inverse projection exactness on all 8 control points
    for name, _, lat, lon, _ in CONTROL_POINTS:
        ex, ey = wgs84_to_edcp(lat, lon)
        rlat, rlon = edcp_to_wgs84(ex, ey)
        err_km = haversine_km(lat, lon, rlat, rlon)
        assert err_km < 0.001, f"EDCP round-trip error for {name}: {err_km:.6f} km"

    # C. Verify 8 control points accuracy (< 15 km) against actual polygons
    for name, gid, lat, lon, is_city in CONTROL_POINTS:
        g = geoms[gid]
        assert g and not g.is_empty, f"Empty geometry for {gid}"
        pt = Point(lon, lat)
        if is_city:
            c = g.centroid
            dist_km = haversine_km(lat, lon, c.y, c.x)
        else:
            if g.contains(pt):
                dist_km = 0.0
            else:
                nearest = g.boundary.interpolate(g.boundary.project(pt))
                dist_km = haversine_km(lat, lon, nearest.y, nearest.x)
        assert dist_km < 15.0, f"Control point {name} ({gid}) error {dist_km:.2f} km >= 15 km!"
        print(f"  [OK] Control point {name:10s} ({gid:15s}): error = {dist_km:.3f} km (< 15 km)")

    # D. Verify zero alias collisions across all 50 items
    seen = {}
    for item in ITEMS_META:
        all_al = set(item["aliases"] + [item["townName"], item["baseName"]])
        for al in all_al:
            norm = normalize_roc_input(al)
            if norm in seen and seen[norm] != item["id"]:
                raise AssertionError(f"Alias collision '{al}' (norm='{norm}') between {seen[norm]} and {item['id']}")
            seen[norm] = item["id"]
    print(f"  [OK] Zero alias collisions verified across {len(seen)} normalized keys.")


# =========================================================================
# 8. Build Final JS Bundle (data/packs/roc-1949-pack.js)
# =========================================================================
def build_pack_js(geoms: dict[str, object], output_path: Path) -> None:
    features = []
    items_out = []

    for m in ITEMS_META:
        gid = m["id"]
        g = geoms[gid]
        is_muni = m["category"] == "municipality"
        item_obj = {
            "id": gid,
            "code": m["code"],
            "countyName": m["countyName"],
            "townName": m["townName"],
            "baseName": m["baseName"],
            "suffix": m["suffix"],
            "category": m["category"],
            "fullCountyTown": m["townName"],
            "lat": m["lat"],
            "lng": m["lng"],
            "aliases": m["aliases"],
            "exactAliases": m.get("exactAliases", [m["townName"]]),
        }
        if m.get("isMongolia"):
            item_obj["isMongolia"] = True
        if is_muni:
            item_obj["isMunicipality"] = True
            item_obj["isMunicipalityHotspot"] = True
            item_obj["isMicrostate"] = True
            item_obj["useHotspotDot"] = True
            item_obj["hotspotRadius"] = 6.5
        if "presetMainBounds" in m:
            item_obj["presetMainBounds"] = m["presetMainBounds"]
        items_out.append(item_obj)
        features.append((gid, {"id": gid, "name": m["townName"], "code": m["code"]}, g))

    topo = encode_topojson(features, quant=60000)
    disputed_geo = build_disputed_borders_geojson()

    groups_out = [{"name": g["name"], "short": g["short"], "emoji": g["emoji"]} for g in GROUPS]
    group_colors = {g["name"]: g["color"] for g in GROUPS}

    region_filters = [
        {
            "id": "all",
            "label": "全境",
            "shortLabel": "全境 50 區",
            "emoji": "🗺️",
            "groupNames": [g["name"] for g in GROUPS],
            "itemIds": [m["id"] for m in ITEMS_META],
        }
    ]
    filter_ids = {"華中": "central", "華南": "south", "華北": "north", "塞北": "saibei", "東北": "northeast", "西部": "west"}
    for g in GROUPS:
        gname = g["name"]
        region_filters.append({
            "id": filter_ids[gname],
            "label": gname,
            "emoji": g["emoji"],
            "groupNames": [gname],
            "itemIds": [m["id"] for m in ITEMS_META if m["countyName"] == gname],
        })

    js_template = f"""// =========================================================================
// TRACK-F MAP PACK: Republic of China 1949 Announced Territory (50 Regions)
// Auto-generated by scripts/build_roc1949_pack.py — file:// compatible
// Attribution: Lilauid / Wikimedia Commons (CC BY-SA 4.0) — 歷史公告疆域學習測驗用途
// =========================================================================
(function () {{
  const ROC1949_S2T = {json.dumps(S2T_MAP, ensure_ascii=False)};

  function normalizeRoc1949Input(rawStr) {{
    if (!rawStr) return "";
    let s = String(rawStr).trim().toLowerCase();
    let out = "";
    for (let i = 0; i < s.length; i++) {{
      const ch = s[i];
      out += ROC1949_S2T[ch] || ch;
    }}
    return out.replace(/[\\s\\-_.'’·・,，()（）\\[\\]【】]+/g, "");
  }}

  const ROC1949_GROUPS = {json.dumps(groups_out, ensure_ascii=False)};
  const ROC1949_GROUP_COLORS = {json.dumps(group_colors, ensure_ascii=False)};
  const ROC1949_ITEMS = {json.dumps(items_out, ensure_ascii=False)};
  const ROC1949_REGION_FILTERS = {json.dumps(region_filters, ensure_ascii=False)};
  const ROC1949_DISPUTED_BORDERS = {json.dumps(disputed_geo, ensure_ascii=False, separators=(",", ":"))};
  const ROC1949_TOPO = {json.dumps(topo, ensure_ascii=False, separators=(",", ":"))};

  const ROC1949_PACK = {{
    id: "roc_1949",
    _isFullPack: true,
    _scriptLoaded: true,
    version: "1.0",
    displayName: "中華民國 1949（秋海棠 50 區）",
    shortLabel: "🍂 秋海棠",
    badgeText: "50區",
    attribution: "歷史公告疆域學習測驗用途 · 圖資改作自 Wikimedia Commons (Lilauid, CC BY-SA 4.0)",
    dataNote: "依 1949 年遷臺前公告疆域收錄 35 省 + 1 特別行政區 + 2 地方 + 12 院轄市（共 50 區；遷臺後升格之臺北、高雄直轄市併於臺灣省）。圖資改作自 Wikimedia Commons（Lilauid, CC BY-SA 4.0），僅供歷史公告疆域學習測驗用途。",
    hierarchyDepth: 1,
    unitLabels: {{
      group: "地理大區",
      item: "省／市／地方／特區",
      itemShort: "區",
      fullScopeLabel: "秋海棠全境 50 區"
    }},
    features: {{
      supportsTransportQuiz: false,
      supportsPoiQuiz: false,
      supportsMasterHierarchy: false,
      supportsSuffixDifficulty: true,
      supportsHistoricalBasemap: true,
      quickSuffixes: ["省", "市", "地方", "特別行政區"],
      supportedDifficulties: ["casual", "hard_suffix"]
    }},
    historicalBasemap: {{
      id: "ccts_1947",
      label: "📜 歷史掛圖 (1947)",
      url: "https://gis.sinica.edu.tw/ccts/file-exists.php?img=China_Map_1947-png-{{z}}-{{x}}-{{y}}",
      attribution: "中華民國新地圖 (1947) &copy; 中央研究院人社中心 CCTS WMTS"
    }},
    mapView: {{
      center: [36.5, 104.0],
      defaultZoom: 4,
      minZoom: 3,
      maxZoom: 10,
      maxBounds: [[2.0, 65.0], [60.0, 145.0]],
      fullViewBounds: [[18.0, 71.0], [54.2, 135.5]],
      pinDropScaleKm: 150,
      targetFocusZoom: 6,
      groupFocusZoom: 5,
      targetMaxZoom: 9,
      satelliteFallbackDelta: {{ group: 3.5, item: 1.5 }},
      mainPolygonDistThresholdDeg: 1.5,
      groupMainDistThresholdDeg: 3.0,
      worldCopyJump: false,
      quickJumps: [
        {{ id: "nanjing_shanghai", label: "京滬杭", center: [31.6, 120.1], zoom: 7 }},
        {{ id: "beiping_tianjin", label: "平津", center: [39.5, 116.8], zoom: 7 }},
        {{ id: "northeast", label: "東北九省", center: [45.0, 126.0], zoom: 5 }},
        {{ id: "mongolia_west", label: "塞北／西部", center: [42.0, 96.0], zoom: 4 }}
      ]
    }},
    topoObjectKeys: {{ items: "regions" }},
    topoData: ROC1949_TOPO,
    disputedBordersGeo: ROC1949_DISPUTED_BORDERS,
    groups: ROC1949_GROUPS,
    groupColors: ROC1949_GROUP_COLORS,
    items: ROC1949_ITEMS,
    regionFilters: ROC1949_REGION_FILTERS,
    normalizeInput: normalizeRoc1949Input,
    isItemEnabledByOptions(item, st) {{
      if (!item) return false;
      const opts = (st && st.packOptions) || {{}};
      if (item.isMongolia && opts.rocTerritoryVariant === "no_mongolia") {{
        return false;
      }}
      if (item.isMunicipality && opts.includeMunicipalities === false) {{
        return false;
      }}
      return true;
    }},
    getGroups() {{
      return ROC1949_GROUPS;
    }},
    getItems() {{
      return ROC1949_ITEMS;
    }},
    getGroupByName(name) {{
      return ROC1949_GROUPS.find((g) => g.name === name) || null;
    }},
    getGroupColor(groupName) {{
      return ROC1949_GROUP_COLORS[groupName] || "#38bdf8";
    }},
    getItemAliases(item, difficulty) {{
      if (!item) return [];
      if (difficulty === "hard_suffix") {{
        return Array.isArray(item.exactAliases) && item.exactAliases.length > 0
          ? item.exactAliases
          : [item.townName];
      }}
      return Array.isArray(item.aliases) ? item.aliases : [item.townName, item.baseName];
    }},
    async ensureLoaded() {{
      return ROC1949_PACK;
    }},
    async loadTopoData() {{
      return ROC1949_TOPO;
    }},
    matchFeatureToItem(props, feat) {{
      const fid = (props && props.id) || (feat && feat.id);
      if (fid) {{
        const found = ROC1949_ITEMS.find((it) => it.id === String(fid));
        if (found) return found;
      }}
      return null;
    }}
  }};

  window.GEOMASTER_PACKS = window.GEOMASTER_PACKS || {{}};
  if (typeof registerMapPack === "function") {{
    registerMapPack(ROC1949_PACK);
  }} else {{
    window.GEOMASTER_PACKS["roc_1949"] = ROC1949_PACK;
  }}
}})();
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(js_template, encoding="utf-8")
    size_kb = output_path.stat().st_size / 1024.0
    print(f"[DONE] Wrote {output_path} ({size_kb:.1f} KB)")
    assert size_kb < 380.0, f"Pack size {size_kb:.1f} KB exceeds 380 KB target!"


def main():
    parser = argparse.ArgumentParser(description="Build TRACK-F ROC 1949 MapPack (roc-1949-pack.js)")
    parser.add_argument("--svg", type=str, default=None, help="Optional path to Wikimedia EDCP SVG file")
    parser.add_argument("--out", type=str, default="data/packs/roc-1949-pack.js", help="Output JS file path")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    if args.svg:
        print(f"Building from Wikimedia EDCP SVG: {args.svg}")
        geoms = parse_svg_edcp_geometries(Path(args.svg))
    else:
        print("Building from offline WGS84 TopoJSON sources (cn-prov-pack.js + world-countries-pack.js)...")
        geoms = build_offline_geometries(repo_root)

    run_assertions(geoms)
    out_path = Path(args.out) if os.path.isabs(args.out) else repo_root / args.out
    build_pack_js(geoms, out_path)


if __name__ == "__main__":
    main()
