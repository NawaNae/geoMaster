// ================================================================
// CAPITAL POI DATA — China, ROC 1949 & World Capitals
// ================================================================
// Modular, file:// compatible. Loaded after data/poi-data.js.
// - cn_prov: 27 provincial capitals & autonomous region capitals
// - roc_1949: 38 provincial / area / SAR capitals (1949 announced territory)
// - world_countries: 196 national capitals (respects worldIncludeMicrostates)

const CAPITAL_SUBTYPES = [
  { id: "prov_capital", label: "省會／首府", shortLabel: "省會", icon: "🏛️", tier: "simple", isDefault: true },
  { id: "national_capital", label: "國家首都", shortLabel: "首都", icon: "🏛️", tier: "simple", isDefault: true }
];

const CAPITAL_POI_DATA = [
  {
    "id": "cap_cn_prov_cn_130000",
    "packId": "cn_prov",
    "parentItemId": "cn_130000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "石家莊",
    "shortName": "石家莊",
    "countyName": "華北",
    "townName": "河北省",
    "lat": 38.0428,
    "lng": 114.5149,
    "aliases": [
      "石家莊市",
      "石家庄",
      "石家庄市",
      "Shijiazhuang"
    ]
  },
  {
    "id": "cap_cn_prov_cn_140000",
    "packId": "cn_prov",
    "parentItemId": "cn_140000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "太原",
    "shortName": "太原",
    "countyName": "華北",
    "townName": "山西省",
    "lat": 37.8706,
    "lng": 112.5489,
    "aliases": [
      "太原市",
      "Taiyuan"
    ]
  },
  {
    "id": "cap_cn_prov_cn_150000",
    "packId": "cn_prov",
    "parentItemId": "cn_150000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "呼和浩特",
    "shortName": "呼和浩特",
    "countyName": "華北",
    "townName": "內蒙古自治區",
    "lat": 40.8414,
    "lng": 111.7519,
    "aliases": [
      "呼和浩特市",
      "呼市",
      "歸綏",
      "Hohhot",
      "Huhehaote"
    ]
  },
  {
    "id": "cap_cn_prov_cn_210000",
    "packId": "cn_prov",
    "parentItemId": "cn_210000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "瀋陽",
    "shortName": "瀋陽",
    "countyName": "東北",
    "townName": "遼寧省",
    "lat": 41.8057,
    "lng": 123.4315,
    "aliases": [
      "瀋陽市",
      "沈阳",
      "沈阳市",
      "奉天",
      "Shenyang"
    ]
  },
  {
    "id": "cap_cn_prov_cn_220000",
    "packId": "cn_prov",
    "parentItemId": "cn_220000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "長春",
    "shortName": "長春",
    "countyName": "東北",
    "townName": "吉林省",
    "lat": 43.8171,
    "lng": 125.3235,
    "aliases": [
      "長春市",
      "长春",
      "长春市",
      "Changchun"
    ]
  },
  {
    "id": "cap_cn_prov_cn_230000",
    "packId": "cn_prov",
    "parentItemId": "cn_230000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "哈爾濱",
    "shortName": "哈爾濱",
    "countyName": "東北",
    "townName": "黑龍江省",
    "lat": 45.8038,
    "lng": 126.535,
    "aliases": [
      "哈爾濱市",
      "哈尔滨",
      "哈尔滨市",
      "Harbin"
    ]
  },
  {
    "id": "cap_cn_prov_cn_320000",
    "packId": "cn_prov",
    "parentItemId": "cn_320000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "南京",
    "shortName": "南京",
    "countyName": "華東",
    "townName": "江蘇省",
    "lat": 32.0603,
    "lng": 118.7969,
    "aliases": [
      "南京市",
      "Nanjing",
      "Nanking"
    ]
  },
  {
    "id": "cap_cn_prov_cn_330000",
    "packId": "cn_prov",
    "parentItemId": "cn_330000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "杭州",
    "shortName": "杭州",
    "countyName": "華東",
    "townName": "浙江省",
    "lat": 30.2741,
    "lng": 120.1551,
    "aliases": [
      "杭州市",
      "Hangzhou"
    ]
  },
  {
    "id": "cap_cn_prov_cn_340000",
    "packId": "cn_prov",
    "parentItemId": "cn_340000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "合肥",
    "shortName": "合肥",
    "countyName": "華東",
    "townName": "安徽省",
    "lat": 31.8206,
    "lng": 117.2272,
    "aliases": [
      "合肥市",
      "Hefei"
    ]
  },
  {
    "id": "cap_cn_prov_cn_350000",
    "packId": "cn_prov",
    "parentItemId": "cn_350000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "福州",
    "shortName": "福州",
    "countyName": "華東",
    "townName": "福建省",
    "lat": 26.0745,
    "lng": 119.2965,
    "aliases": [
      "福州市",
      "Fuzhou"
    ]
  },
  {
    "id": "cap_cn_prov_cn_360000",
    "packId": "cn_prov",
    "parentItemId": "cn_360000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "南昌",
    "shortName": "南昌",
    "countyName": "華東",
    "townName": "江西省",
    "lat": 28.682,
    "lng": 115.8579,
    "aliases": [
      "南昌市",
      "Nanchang"
    ]
  },
  {
    "id": "cap_cn_prov_cn_370000",
    "packId": "cn_prov",
    "parentItemId": "cn_370000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "濟南",
    "shortName": "濟南",
    "countyName": "華東",
    "townName": "山東省",
    "lat": 36.6512,
    "lng": 117.1201,
    "aliases": [
      "濟南市",
      "济南",
      "济南市",
      "Jinan"
    ]
  },
  {
    "id": "cap_cn_prov_cn_410000",
    "packId": "cn_prov",
    "parentItemId": "cn_410000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "鄭州",
    "shortName": "鄭州",
    "countyName": "華中",
    "townName": "河南省",
    "lat": 34.7466,
    "lng": 113.6253,
    "aliases": [
      "鄭州市",
      "郑州",
      "郑州市",
      "Zhengzhou"
    ]
  },
  {
    "id": "cap_cn_prov_cn_420000",
    "packId": "cn_prov",
    "parentItemId": "cn_420000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "武漢",
    "shortName": "武漢",
    "countyName": "華中",
    "townName": "湖北省",
    "lat": 30.5928,
    "lng": 114.3055,
    "aliases": [
      "武漢市",
      "武汉",
      "武汉市",
      "Wuhan"
    ]
  },
  {
    "id": "cap_cn_prov_cn_430000",
    "packId": "cn_prov",
    "parentItemId": "cn_430000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "長沙",
    "shortName": "長沙",
    "countyName": "華中",
    "townName": "湖南省",
    "lat": 28.2282,
    "lng": 112.9388,
    "aliases": [
      "長沙市",
      "长沙",
      "长沙市",
      "Changsha"
    ]
  },
  {
    "id": "cap_cn_prov_cn_440000",
    "packId": "cn_prov",
    "parentItemId": "cn_440000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "廣州",
    "shortName": "廣州",
    "countyName": "華南",
    "townName": "廣東省",
    "lat": 23.1291,
    "lng": 113.2644,
    "aliases": [
      "廣州市",
      "广州",
      "广州市",
      "Guangzhou",
      "Canton"
    ]
  },
  {
    "id": "cap_cn_prov_cn_450000",
    "packId": "cn_prov",
    "parentItemId": "cn_450000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "南寧",
    "shortName": "南寧",
    "countyName": "華南",
    "townName": "廣西壯族自治區",
    "lat": 22.817,
    "lng": 108.3665,
    "aliases": [
      "南寧市",
      "南宁",
      "南宁市",
      "Nanning"
    ]
  },
  {
    "id": "cap_cn_prov_cn_460000",
    "packId": "cn_prov",
    "parentItemId": "cn_460000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "海口",
    "shortName": "海口",
    "countyName": "華南",
    "townName": "海南省",
    "lat": 20.044,
    "lng": 110.1999,
    "aliases": [
      "海口市",
      "Haikou"
    ]
  },
  {
    "id": "cap_cn_prov_cn_510000",
    "packId": "cn_prov",
    "parentItemId": "cn_510000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "成都",
    "shortName": "成都",
    "countyName": "西南",
    "townName": "四川省",
    "lat": 30.5728,
    "lng": 104.0668,
    "aliases": [
      "成都市",
      "Chengdu"
    ]
  },
  {
    "id": "cap_cn_prov_cn_520000",
    "packId": "cn_prov",
    "parentItemId": "cn_520000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "貴陽",
    "shortName": "貴陽",
    "countyName": "西南",
    "townName": "貴州省",
    "lat": 26.647,
    "lng": 106.6302,
    "aliases": [
      "貴陽市",
      "贵阳",
      "贵阳市",
      "Guiyang"
    ]
  },
  {
    "id": "cap_cn_prov_cn_530000",
    "packId": "cn_prov",
    "parentItemId": "cn_530000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "昆明",
    "shortName": "昆明",
    "countyName": "西南",
    "townName": "雲南省",
    "lat": 25.0389,
    "lng": 102.7183,
    "aliases": [
      "昆明市",
      "Kunming"
    ]
  },
  {
    "id": "cap_cn_prov_cn_540000",
    "packId": "cn_prov",
    "parentItemId": "cn_540000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "拉薩",
    "shortName": "拉薩",
    "countyName": "西南",
    "townName": "西藏自治區",
    "lat": 29.65,
    "lng": 91.1,
    "aliases": [
      "拉薩市",
      "拉萨",
      "拉萨市",
      "Lhasa"
    ]
  },
  {
    "id": "cap_cn_prov_cn_610000",
    "packId": "cn_prov",
    "parentItemId": "cn_610000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "西安",
    "shortName": "西安",
    "countyName": "西北",
    "townName": "陝西省",
    "lat": 34.3416,
    "lng": 108.9398,
    "aliases": [
      "西安市",
      "Xian",
      "Xi'an"
    ]
  },
  {
    "id": "cap_cn_prov_cn_620000",
    "packId": "cn_prov",
    "parentItemId": "cn_620000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "蘭州",
    "shortName": "蘭州",
    "countyName": "西北",
    "townName": "甘肅省",
    "lat": 36.0611,
    "lng": 103.8343,
    "aliases": [
      "蘭州市",
      "兰州",
      "兰州市",
      "Lanzhou"
    ]
  },
  {
    "id": "cap_cn_prov_cn_630000",
    "packId": "cn_prov",
    "parentItemId": "cn_630000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "西寧",
    "shortName": "西寧",
    "countyName": "西北",
    "townName": "青海省",
    "lat": 36.6171,
    "lng": 101.7782,
    "aliases": [
      "西寧市",
      "西宁",
      "西宁市",
      "Xining"
    ]
  },
  {
    "id": "cap_cn_prov_cn_640000",
    "packId": "cn_prov",
    "parentItemId": "cn_640000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "銀川",
    "shortName": "銀川",
    "countyName": "西北",
    "townName": "寧夏回族自治區",
    "lat": 38.4872,
    "lng": 106.2309,
    "aliases": [
      "銀川市",
      "银川",
      "银川市",
      "Yinchuan"
    ]
  },
  {
    "id": "cap_cn_prov_cn_650000",
    "packId": "cn_prov",
    "parentItemId": "cn_650000",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "烏魯木齊",
    "shortName": "烏魯木齊",
    "countyName": "西北",
    "townName": "新疆維吾爾自治區",
    "lat": 43.8256,
    "lng": 87.6168,
    "aliases": [
      "烏魯木齊市",
      "乌鲁木齐",
      "乌鲁木齐市",
      "迪化",
      "Urumqi",
      "Ürümqi"
    ]
  },
  {
    "id": "cap_roc_1949_roc_jiangsu",
    "packId": "roc_1949",
    "parentItemId": "roc_jiangsu",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "鎮江",
    "shortName": "鎮江",
    "countyName": "華中",
    "townName": "江蘇省",
    "lat": 32.2044,
    "lng": 119.4528,
    "aliases": [
      "鎮江市",
      "鎮江縣",
      "镇江",
      "Zhenjiang"
    ]
  },
  {
    "id": "cap_roc_1949_roc_zhejiang",
    "packId": "roc_1949",
    "parentItemId": "roc_zhejiang",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "杭州",
    "shortName": "杭州",
    "countyName": "華中",
    "townName": "浙江省",
    "lat": 30.2741,
    "lng": 120.1551,
    "aliases": [
      "杭州市",
      "Hangzhou"
    ]
  },
  {
    "id": "cap_roc_1949_roc_anhui",
    "packId": "roc_1949",
    "parentItemId": "roc_anhui",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "合肥",
    "shortName": "合肥",
    "countyName": "華中",
    "townName": "安徽省",
    "lat": 31.8206,
    "lng": 117.2272,
    "aliases": [
      "合肥縣",
      "合肥市",
      "Hefei"
    ]
  },
  {
    "id": "cap_roc_1949_roc_jiangxi",
    "packId": "roc_1949",
    "parentItemId": "roc_jiangxi",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "南昌",
    "shortName": "南昌",
    "countyName": "華中",
    "townName": "江西省",
    "lat": 28.682,
    "lng": 115.8579,
    "aliases": [
      "南昌市",
      "Nanchang"
    ]
  },
  {
    "id": "cap_roc_1949_roc_hubei",
    "packId": "roc_1949",
    "parentItemId": "roc_hubei",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "武昌",
    "shortName": "武昌",
    "countyName": "華中",
    "townName": "湖北省",
    "lat": 30.5454,
    "lng": 114.3075,
    "aliases": [
      "武昌市",
      "武漢",
      "武汉",
      "Wuchang",
      "Wuhan"
    ]
  },
  {
    "id": "cap_roc_1949_roc_hunan",
    "packId": "roc_1949",
    "parentItemId": "roc_hunan",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "長沙",
    "shortName": "長沙",
    "countyName": "華中",
    "townName": "湖南省",
    "lat": 28.2282,
    "lng": 112.9388,
    "aliases": [
      "長沙市",
      "长沙",
      "Changsha"
    ]
  },
  {
    "id": "cap_roc_1949_roc_sichuan",
    "packId": "roc_1949",
    "parentItemId": "roc_sichuan",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "成都",
    "shortName": "成都",
    "countyName": "華中",
    "townName": "四川省",
    "lat": 30.5728,
    "lng": 104.0668,
    "aliases": [
      "成都市",
      "Chengdu"
    ]
  },
  {
    "id": "cap_roc_1949_roc_xikang",
    "packId": "roc_1949",
    "parentItemId": "roc_xikang",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "康定",
    "shortName": "康定",
    "countyName": "西部",
    "townName": "西康省",
    "lat": 30.0507,
    "lng": 101.9638,
    "aliases": [
      "康定縣",
      "康定市",
      "Kangding"
    ]
  },
  {
    "id": "cap_roc_1949_roc_fujian",
    "packId": "roc_1949",
    "parentItemId": "roc_fujian",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "福州",
    "shortName": "福州",
    "countyName": "華南",
    "townName": "福建省",
    "lat": 26.0745,
    "lng": 119.2965,
    "aliases": [
      "福州市",
      "Fuzhou"
    ]
  },
  {
    "id": "cap_roc_1949_roc_taiwan",
    "packId": "roc_1949",
    "parentItemId": "roc_taiwan",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "臺北",
    "shortName": "臺北",
    "countyName": "華南",
    "townName": "臺灣省",
    "lat": 25.033,
    "lng": 121.5654,
    "aliases": [
      "台北",
      "臺北市",
      "台北市",
      "中興新村",
      "Taipei"
    ]
  },
  {
    "id": "cap_roc_1949_roc_guangdong",
    "packId": "roc_1949",
    "parentItemId": "roc_guangdong",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "廣州",
    "shortName": "廣州",
    "countyName": "華南",
    "townName": "廣東省",
    "lat": 23.1291,
    "lng": 113.2644,
    "aliases": [
      "廣州市",
      "广州",
      "Guangzhou",
      "Canton"
    ]
  },
  {
    "id": "cap_roc_1949_roc_guangxi",
    "packId": "roc_1949",
    "parentItemId": "roc_guangxi",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "桂林",
    "shortName": "桂林",
    "countyName": "華南",
    "townName": "廣西省",
    "lat": 25.2742,
    "lng": 110.2993,
    "aliases": [
      "桂林市",
      "Guilin"
    ]
  },
  {
    "id": "cap_roc_1949_roc_yunnan",
    "packId": "roc_1949",
    "parentItemId": "roc_yunnan",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "昆明",
    "shortName": "昆明",
    "countyName": "華南",
    "townName": "雲南省",
    "lat": 25.0389,
    "lng": 102.7183,
    "aliases": [
      "昆明市",
      "Kunming"
    ]
  },
  {
    "id": "cap_roc_1949_roc_guizhou",
    "packId": "roc_1949",
    "parentItemId": "roc_guizhou",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "貴陽",
    "shortName": "貴陽",
    "countyName": "華南",
    "townName": "貴州省",
    "lat": 26.647,
    "lng": 106.6302,
    "aliases": [
      "貴陽市",
      "贵阳",
      "Guiyang"
    ]
  },
  {
    "id": "cap_roc_1949_roc_hebei",
    "packId": "roc_1949",
    "parentItemId": "roc_hebei",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "清苑",
    "shortName": "清苑",
    "countyName": "華北",
    "townName": "河北省",
    "lat": 38.8738,
    "lng": 115.4648,
    "aliases": [
      "清苑縣",
      "保定",
      "保定市",
      "Qingyuan",
      "Baoding"
    ]
  },
  {
    "id": "cap_roc_1949_roc_shandong",
    "packId": "roc_1949",
    "parentItemId": "roc_shandong",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "濟南",
    "shortName": "濟南",
    "countyName": "華北",
    "townName": "山東省",
    "lat": 36.6512,
    "lng": 117.1201,
    "aliases": [
      "濟南市",
      "济南",
      "Jinan"
    ]
  },
  {
    "id": "cap_roc_1949_roc_henan",
    "packId": "roc_1949",
    "parentItemId": "roc_henan",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "開封",
    "shortName": "開封",
    "countyName": "華北",
    "townName": "河南省",
    "lat": 34.7972,
    "lng": 114.3076,
    "aliases": [
      "開封縣",
      "開封市",
      "开封",
      "Kaifeng"
    ]
  },
  {
    "id": "cap_roc_1949_roc_shanxi",
    "packId": "roc_1949",
    "parentItemId": "roc_shanxi",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "太原",
    "shortName": "太原",
    "countyName": "華北",
    "townName": "山西省",
    "lat": 37.8706,
    "lng": 112.5489,
    "aliases": [
      "太原市",
      "Taiyuan"
    ]
  },
  {
    "id": "cap_roc_1949_roc_shaanxi",
    "packId": "roc_1949",
    "parentItemId": "roc_shaanxi",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "西安",
    "shortName": "西安",
    "countyName": "華北",
    "townName": "陝西省",
    "lat": 34.3416,
    "lng": 108.9398,
    "aliases": [
      "西安市",
      "Xian",
      "Xi'an"
    ]
  },
  {
    "id": "cap_roc_1949_roc_gansu",
    "packId": "roc_1949",
    "parentItemId": "roc_gansu",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "蘭州",
    "shortName": "蘭州",
    "countyName": "華北",
    "townName": "甘肅省",
    "lat": 36.0611,
    "lng": 103.8343,
    "aliases": [
      "蘭州市",
      "兰州",
      "Lanzhou"
    ]
  },
  {
    "id": "cap_roc_1949_roc_ningxia",
    "packId": "roc_1949",
    "parentItemId": "roc_ningxia",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "銀川",
    "shortName": "銀川",
    "countyName": "塞北",
    "townName": "寧夏省",
    "lat": 38.4872,
    "lng": 106.2309,
    "aliases": [
      "銀川市",
      "银川",
      "寧夏市",
      "Yinchuan"
    ]
  },
  {
    "id": "cap_roc_1949_roc_qinghai",
    "packId": "roc_1949",
    "parentItemId": "roc_qinghai",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "西寧",
    "shortName": "西寧",
    "countyName": "西部",
    "townName": "青海省",
    "lat": 36.6171,
    "lng": 101.7782,
    "aliases": [
      "西寧市",
      "西宁",
      "Xining"
    ]
  },
  {
    "id": "cap_roc_1949_roc_suiyuan",
    "packId": "roc_1949",
    "parentItemId": "roc_suiyuan",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "歸綏",
    "shortName": "歸綏",
    "countyName": "塞北",
    "townName": "綏遠省",
    "lat": 40.8414,
    "lng": 111.7519,
    "aliases": [
      "歸綏市",
      "归绥",
      "呼和浩特",
      "Guisui",
      "Hohhot"
    ]
  },
  {
    "id": "cap_roc_1949_roc_chahar",
    "packId": "roc_1949",
    "parentItemId": "roc_chahar",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "張垣",
    "shortName": "張垣",
    "countyName": "塞北",
    "townName": "察哈爾省",
    "lat": 40.8244,
    "lng": 114.8875,
    "aliases": [
      "張垣市",
      "张垣",
      "張家口",
      "张家口",
      "Zhangyuan",
      "Zhangjiakou",
      "Kalgan"
    ]
  },
  {
    "id": "cap_roc_1949_roc_rehe",
    "packId": "roc_1949",
    "parentItemId": "roc_rehe",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "承德",
    "shortName": "承德",
    "countyName": "塞北",
    "townName": "熱河省",
    "lat": 40.9525,
    "lng": 117.9634,
    "aliases": [
      "承德縣",
      "承德市",
      "Chengde"
    ]
  },
  {
    "id": "cap_roc_1949_roc_liaoning",
    "packId": "roc_1949",
    "parentItemId": "roc_liaoning",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "瀋陽",
    "shortName": "瀋陽",
    "countyName": "東北",
    "townName": "遼寧省",
    "lat": 41.8057,
    "lng": 123.4315,
    "aliases": [
      "瀋陽市",
      "沈阳",
      "奉天",
      "Shenyang"
    ]
  },
  {
    "id": "cap_roc_1949_roc_andong",
    "packId": "roc_1949",
    "parentItemId": "roc_andong",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "通化",
    "shortName": "通化",
    "countyName": "東北",
    "townName": "安東省",
    "lat": 41.7284,
    "lng": 125.9397,
    "aliases": [
      "通化市",
      "Tonghua"
    ]
  },
  {
    "id": "cap_roc_1949_roc_liaobei",
    "packId": "roc_1949",
    "parentItemId": "roc_liaobei",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "遼源",
    "shortName": "遼源",
    "countyName": "東北",
    "townName": "遼北省",
    "lat": 43.5067,
    "lng": 123.505,
    "aliases": [
      "遼源縣",
      "辽源",
      "雙遼",
      "双辽",
      "Liaoyuan"
    ]
  },
  {
    "id": "cap_roc_1949_roc_jilin",
    "packId": "roc_1949",
    "parentItemId": "roc_jilin",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "吉林",
    "shortName": "吉林",
    "countyName": "東北",
    "townName": "吉林省",
    "lat": 43.8378,
    "lng": 126.5496,
    "aliases": [
      "吉林市",
      "Jilin"
    ]
  },
  {
    "id": "cap_roc_1949_roc_songjiang",
    "packId": "roc_1949",
    "parentItemId": "roc_songjiang",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "牡丹江",
    "shortName": "牡丹江",
    "countyName": "東北",
    "townName": "松江省",
    "lat": 44.5517,
    "lng": 129.6331,
    "aliases": [
      "牡丹江市",
      "Mudanjiang"
    ]
  },
  {
    "id": "cap_roc_1949_roc_hejiang",
    "packId": "roc_1949",
    "parentItemId": "roc_hejiang",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "佳木斯",
    "shortName": "佳木斯",
    "countyName": "東北",
    "townName": "合江省",
    "lat": 46.7999,
    "lng": 130.3189,
    "aliases": [
      "佳木斯市",
      "Jiamusi"
    ]
  },
  {
    "id": "cap_roc_1949_roc_heilongjiang",
    "packId": "roc_1949",
    "parentItemId": "roc_heilongjiang",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "北安",
    "shortName": "北安",
    "countyName": "東北",
    "townName": "黑龍江省",
    "lat": 48.245,
    "lng": 126.5122,
    "aliases": [
      "北安市",
      "北安縣",
      "Beian",
      "Bei'an"
    ]
  },
  {
    "id": "cap_roc_1949_roc_nenjiang",
    "packId": "roc_1949",
    "parentItemId": "roc_nenjiang",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "齊齊哈爾",
    "shortName": "齊齊哈爾",
    "countyName": "東北",
    "townName": "嫩江省",
    "lat": 47.3543,
    "lng": 123.9182,
    "aliases": [
      "齊齊哈爾市",
      "齐齐哈尔",
      "Qiqihar"
    ]
  },
  {
    "id": "cap_roc_1949_roc_xingan",
    "packId": "roc_1949",
    "parentItemId": "roc_xingan",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "海拉爾",
    "shortName": "海拉爾",
    "countyName": "東北",
    "townName": "興安省",
    "lat": 49.2122,
    "lng": 119.7657,
    "aliases": [
      "海拉爾市",
      "海拉尔",
      "呼倫貝爾",
      "呼伦贝尔",
      "Hailar",
      "Hulunbuir"
    ]
  },
  {
    "id": "cap_roc_1949_roc_xinjiang",
    "packId": "roc_1949",
    "parentItemId": "roc_xinjiang",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "迪化",
    "shortName": "迪化",
    "countyName": "西部",
    "townName": "新疆省",
    "lat": 43.8256,
    "lng": 87.6168,
    "aliases": [
      "迪化市",
      "烏魯木齊",
      "乌鲁木齐",
      "Dihua",
      "Urumqi"
    ]
  },
  {
    "id": "cap_roc_1949_roc_hainan",
    "packId": "roc_1949",
    "parentItemId": "roc_hainan",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "海口",
    "shortName": "海口",
    "countyName": "華南",
    "townName": "海南特別行政區",
    "lat": 20.044,
    "lng": 110.1999,
    "aliases": [
      "海口市",
      "Haikou"
    ]
  },
  {
    "id": "cap_roc_1949_roc_tibet",
    "packId": "roc_1949",
    "parentItemId": "roc_tibet",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "拉薩",
    "shortName": "拉薩",
    "countyName": "西部",
    "townName": "西藏地方",
    "lat": 29.65,
    "lng": 91.1,
    "aliases": [
      "拉薩市",
      "拉萨",
      "Lhasa"
    ]
  },
  {
    "id": "cap_roc_1949_roc_mongolia",
    "packId": "roc_1949",
    "parentItemId": "roc_mongolia",
    "category": "capital",
    "subTypes": [
      "prov_capital"
    ],
    "name": "庫倫",
    "shortName": "庫倫",
    "countyName": "塞北",
    "townName": "蒙古地方",
    "lat": 47.9184,
    "lng": 106.9177,
    "aliases": [
      "库伦",
      "烏蘭巴托",
      "乌兰巴托",
      "Kulun",
      "Urga",
      "Ulaanbaatar"
    ]
  },
  {
    "id": "cap_world_countries_TWN",
    "packId": "world_countries",
    "parentItemId": "TWN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "臺北",
    "shortName": "臺北",
    "countyName": "亞洲",
    "townName": "台灣",
    "lat": 25.033,
    "lng": 121.5654,
    "aliases": [
      "台北",
      "臺北市",
      "台北市",
      "Taipei"
    ]
  },
  {
    "id": "cap_world_countries_JPN",
    "packId": "world_countries",
    "parentItemId": "JPN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "東京",
    "shortName": "東京",
    "countyName": "亞洲",
    "townName": "日本",
    "lat": 35.6762,
    "lng": 139.6503,
    "aliases": [
      "東京都",
      "东京",
      "Tokyo"
    ]
  },
  {
    "id": "cap_world_countries_KOR",
    "packId": "world_countries",
    "parentItemId": "KOR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "首爾",
    "shortName": "首爾",
    "countyName": "亞洲",
    "townName": "南韓",
    "lat": 37.5665,
    "lng": 126.978,
    "aliases": [
      "首尔",
      "漢城",
      "汉城",
      "Seoul"
    ]
  },
  {
    "id": "cap_world_countries_PRK",
    "packId": "world_countries",
    "parentItemId": "PRK",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "平壤",
    "shortName": "平壤",
    "countyName": "亞洲",
    "townName": "北韓",
    "lat": 39.0392,
    "lng": 125.7625,
    "aliases": [
      "Pyongyang"
    ]
  },
  {
    "id": "cap_world_countries_CHN",
    "packId": "world_countries",
    "parentItemId": "CHN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "北京",
    "shortName": "北京",
    "countyName": "亞洲",
    "townName": "中國",
    "lat": 39.9042,
    "lng": 116.4074,
    "aliases": [
      "北京市",
      "北平",
      "Beijing",
      "Peking"
    ]
  },
  {
    "id": "cap_world_countries_MNG",
    "packId": "world_countries",
    "parentItemId": "MNG",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "烏蘭巴托",
    "shortName": "烏蘭巴托",
    "countyName": "亞洲",
    "townName": "蒙古",
    "lat": 47.9184,
    "lng": 106.9177,
    "aliases": [
      "乌兰巴托",
      "庫倫",
      "Ulaanbaatar",
      "Ulan Bator"
    ]
  },
  {
    "id": "cap_world_countries_VNM",
    "packId": "world_countries",
    "parentItemId": "VNM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "河內",
    "shortName": "河內",
    "countyName": "亞洲",
    "townName": "越南",
    "lat": 21.0285,
    "lng": 105.8542,
    "aliases": [
      "河内",
      "Hanoi"
    ]
  },
  {
    "id": "cap_world_countries_LAO",
    "packId": "world_countries",
    "parentItemId": "LAO",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "永珍",
    "shortName": "永珍",
    "countyName": "亞洲",
    "townName": "寮國",
    "lat": 17.9757,
    "lng": 102.6331,
    "aliases": [
      "萬象",
      "万象",
      "Vientiane"
    ]
  },
  {
    "id": "cap_world_countries_KHM",
    "packId": "world_countries",
    "parentItemId": "KHM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "金邊",
    "shortName": "金邊",
    "countyName": "亞洲",
    "townName": "柬埔寨",
    "lat": 11.5564,
    "lng": 104.9282,
    "aliases": [
      "金边",
      "Phnom Penh"
    ]
  },
  {
    "id": "cap_world_countries_THA",
    "packId": "world_countries",
    "parentItemId": "THA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "曼谷",
    "shortName": "曼谷",
    "countyName": "亞洲",
    "townName": "泰國",
    "lat": 13.7563,
    "lng": 100.5018,
    "aliases": [
      "Bangkok",
      "Krung Thep"
    ]
  },
  {
    "id": "cap_world_countries_MMR",
    "packId": "world_countries",
    "parentItemId": "MMR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "奈比多",
    "shortName": "奈比多",
    "countyName": "亞洲",
    "townName": "緬甸",
    "lat": 19.7633,
    "lng": 96.0785,
    "aliases": [
      "內比都",
      "内比都",
      "Naypyidaw",
      "Nay Pyi Taw"
    ]
  },
  {
    "id": "cap_world_countries_MYS",
    "packId": "world_countries",
    "parentItemId": "MYS",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "吉隆坡",
    "shortName": "吉隆坡",
    "countyName": "亞洲",
    "townName": "馬來西亞",
    "lat": 3.139,
    "lng": 101.6869,
    "aliases": [
      "Kuala Lumpur",
      "布城",
      "布特拉再也",
      "Putrajaya"
    ]
  },
  {
    "id": "cap_world_countries_SGP",
    "packId": "world_countries",
    "parentItemId": "SGP",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "新加坡",
    "shortName": "新加坡",
    "countyName": "亞洲",
    "townName": "新加坡",
    "lat": 1.3521,
    "lng": 103.8198,
    "aliases": [
      "新加坡市",
      "獅城",
      "Singapore"
    ]
  },
  {
    "id": "cap_world_countries_BRN",
    "packId": "world_countries",
    "parentItemId": "BRN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "斯里巴加灣",
    "shortName": "斯里巴加灣",
    "countyName": "亞洲",
    "townName": "汶萊",
    "lat": 4.9031,
    "lng": 114.9398,
    "aliases": [
      "斯里巴加灣市",
      "斯里巴加湾",
      "斯里巴加湾市",
      "汶萊市",
      "Bandar Seri Begawan"
    ]
  },
  {
    "id": "cap_world_countries_IDN",
    "packId": "world_countries",
    "parentItemId": "IDN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "雅加達",
    "shortName": "雅加達",
    "countyName": "亞洲",
    "townName": "印尼",
    "lat": -6.2088,
    "lng": 106.8456,
    "aliases": [
      "雅加达",
      "耶加達",
      "努山塔拉",
      "Jakarta",
      "Nusantara"
    ]
  },
  {
    "id": "cap_world_countries_PHL",
    "packId": "world_countries",
    "parentItemId": "PHL",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "馬尼拉",
    "shortName": "馬尼拉",
    "countyName": "亞洲",
    "townName": "菲律賓",
    "lat": 14.5995,
    "lng": 120.9842,
    "aliases": [
      "马尼拉",
      "Manila"
    ]
  },
  {
    "id": "cap_world_countries_TLS",
    "packId": "world_countries",
    "parentItemId": "TLS",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "狄力",
    "shortName": "狄力",
    "countyName": "亞洲",
    "townName": "東帝汶",
    "lat": -8.5569,
    "lng": 125.5603,
    "aliases": [
      "帝力",
      "Dili"
    ]
  },
  {
    "id": "cap_world_countries_IND",
    "packId": "world_countries",
    "parentItemId": "IND",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "新德里",
    "shortName": "新德里",
    "countyName": "亞洲",
    "townName": "印度",
    "lat": 28.6139,
    "lng": 77.209,
    "aliases": [
      "德里",
      "New Delhi",
      "Delhi"
    ]
  },
  {
    "id": "cap_world_countries_PAK",
    "packId": "world_countries",
    "parentItemId": "PAK",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "伊斯蘭馬巴德",
    "shortName": "伊斯蘭馬巴德",
    "countyName": "亞洲",
    "townName": "巴基斯坦",
    "lat": 33.6844,
    "lng": 73.0479,
    "aliases": [
      "伊斯蘭堡",
      "伊斯兰堡",
      "伊斯兰马巴德",
      "Islamabad"
    ]
  },
  {
    "id": "cap_world_countries_BGD",
    "packId": "world_countries",
    "parentItemId": "BGD",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "達卡",
    "shortName": "達卡",
    "countyName": "亞洲",
    "townName": "孟加拉",
    "lat": 23.8103,
    "lng": 90.4125,
    "aliases": [
      "达卡",
      "Dhaka"
    ]
  },
  {
    "id": "cap_world_countries_LKA",
    "packId": "world_countries",
    "parentItemId": "LKA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "可倫坡",
    "shortName": "可倫坡",
    "countyName": "亞洲",
    "townName": "斯里蘭卡",
    "lat": 6.9271,
    "lng": 79.8612,
    "aliases": [
      "科倫坡",
      "科伦坡",
      "斯里賈亞瓦德納普拉科特",
      "科特",
      "Colombo",
      "Sri Jayawardenepura Kotte",
      "Kotte"
    ]
  },
  {
    "id": "cap_world_countries_NPL",
    "packId": "world_countries",
    "parentItemId": "NPL",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "加德滿都",
    "shortName": "加德滿都",
    "countyName": "亞洲",
    "townName": "尼泊爾",
    "lat": 27.7172,
    "lng": 85.324,
    "aliases": [
      "加德满都",
      "Kathmandu"
    ]
  },
  {
    "id": "cap_world_countries_BTN",
    "packId": "world_countries",
    "parentItemId": "BTN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "辛布",
    "shortName": "辛布",
    "countyName": "亞洲",
    "townName": "不丹",
    "lat": 27.4728,
    "lng": 89.6393,
    "aliases": [
      "廷布",
      "Thimphu"
    ]
  },
  {
    "id": "cap_world_countries_MDV",
    "packId": "world_countries",
    "parentItemId": "MDV",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "馬利",
    "shortName": "馬利",
    "countyName": "亞洲",
    "townName": "馬爾地夫",
    "lat": 4.1755,
    "lng": 73.5093,
    "aliases": [
      "馬累",
      "马累",
      "馬列",
      "Male",
      "Malé"
    ]
  },
  {
    "id": "cap_world_countries_AFG",
    "packId": "world_countries",
    "parentItemId": "AFG",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "喀布爾",
    "shortName": "喀布爾",
    "countyName": "亞洲",
    "townName": "阿富汗",
    "lat": 34.5553,
    "lng": 69.2075,
    "aliases": [
      "喀布尔",
      "Kabul"
    ]
  },
  {
    "id": "cap_world_countries_KAZ",
    "packId": "world_countries",
    "parentItemId": "KAZ",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "阿斯塔納",
    "shortName": "阿斯塔納",
    "countyName": "亞洲",
    "townName": "哈薩克",
    "lat": 51.1694,
    "lng": 71.4491,
    "aliases": [
      "阿斯塔纳",
      "阿斯塔那",
      "努爾蘇丹",
      "努尔苏丹",
      "Astana",
      "Nur-Sultan"
    ]
  },
  {
    "id": "cap_world_countries_UZB",
    "packId": "world_countries",
    "parentItemId": "UZB",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "塔什干",
    "shortName": "塔什干",
    "countyName": "亞洲",
    "townName": "烏茲別克",
    "lat": 41.2995,
    "lng": 69.2401,
    "aliases": [
      "Tashkent"
    ]
  },
  {
    "id": "cap_world_countries_TKM",
    "packId": "world_countries",
    "parentItemId": "TKM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "阿什哈巴特",
    "shortName": "阿什哈巴特",
    "countyName": "亞洲",
    "townName": "土庫曼",
    "lat": 37.9601,
    "lng": 58.3261,
    "aliases": [
      "阿什哈巴德",
      "Ashgabat"
    ]
  },
  {
    "id": "cap_world_countries_KGZ",
    "packId": "world_countries",
    "parentItemId": "KGZ",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "比斯凱克",
    "shortName": "比斯凱克",
    "countyName": "亞洲",
    "townName": "吉爾吉斯",
    "lat": 42.8746,
    "lng": 74.5698,
    "aliases": [
      "比什凱克",
      "比什凯克",
      "Bishkek"
    ]
  },
  {
    "id": "cap_world_countries_TJK",
    "packId": "world_countries",
    "parentItemId": "TJK",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "杜尚貝",
    "shortName": "杜尚貝",
    "countyName": "亞洲",
    "townName": "塔吉克",
    "lat": 38.5598,
    "lng": 68.787,
    "aliases": [
      "杜桑貝",
      "杜尚别",
      "Dushanbe"
    ]
  },
  {
    "id": "cap_world_countries_IRN",
    "packId": "world_countries",
    "parentItemId": "IRN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "德黑蘭",
    "shortName": "德黑蘭",
    "countyName": "亞洲",
    "townName": "伊朗",
    "lat": 35.6892,
    "lng": 51.389,
    "aliases": [
      "德黑兰",
      "Tehran"
    ]
  },
  {
    "id": "cap_world_countries_IRQ",
    "packId": "world_countries",
    "parentItemId": "IRQ",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "巴格達",
    "shortName": "巴格達",
    "countyName": "亞洲",
    "townName": "伊拉克",
    "lat": 33.3152,
    "lng": 44.3661,
    "aliases": [
      "巴格达",
      "Baghdad"
    ]
  },
  {
    "id": "cap_world_countries_SYR",
    "packId": "world_countries",
    "parentItemId": "SYR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "大馬士革",
    "shortName": "大馬士革",
    "countyName": "亞洲",
    "townName": "敘利亞",
    "lat": 33.5138,
    "lng": 36.2765,
    "aliases": [
      "大马士革",
      "Damascus"
    ]
  },
  {
    "id": "cap_world_countries_LBN",
    "packId": "world_countries",
    "parentItemId": "LBN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "貝魯特",
    "shortName": "貝魯特",
    "countyName": "亞洲",
    "townName": "黎巴嫩",
    "lat": 33.8938,
    "lng": 35.5018,
    "aliases": [
      "贝鲁特",
      "Beirut"
    ]
  },
  {
    "id": "cap_world_countries_ISR",
    "packId": "world_countries",
    "parentItemId": "ISR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "耶路撒冷",
    "shortName": "耶路撒冷",
    "countyName": "亞洲",
    "townName": "以色列",
    "lat": 31.7683,
    "lng": 35.2137,
    "aliases": [
      "Jerusalem",
      "特拉維夫",
      "Tel Aviv"
    ]
  },
  {
    "id": "cap_world_countries_PSE",
    "packId": "world_countries",
    "parentItemId": "PSE",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "東耶路撒冷",
    "shortName": "東耶路撒冷",
    "countyName": "亞洲",
    "townName": "巴勒斯坦",
    "lat": 31.7833,
    "lng": 35.2333,
    "aliases": [
      "东耶路撒冷",
      "耶路撒冷",
      "拉姆安拉",
      "拉馬拉",
      "East Jerusalem",
      "Ramallah",
      "Jerusalem"
    ]
  },
  {
    "id": "cap_world_countries_JOR",
    "packId": "world_countries",
    "parentItemId": "JOR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "安曼",
    "shortName": "安曼",
    "countyName": "亞洲",
    "townName": "約旦",
    "lat": 31.9454,
    "lng": 35.9284,
    "aliases": [
      "Amman"
    ]
  },
  {
    "id": "cap_world_countries_SAU",
    "packId": "world_countries",
    "parentItemId": "SAU",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "利雅德",
    "shortName": "利雅德",
    "countyName": "亞洲",
    "townName": "沙烏地阿拉伯",
    "lat": 24.7136,
    "lng": 46.6753,
    "aliases": [
      "利雅得",
      "Riyadh"
    ]
  },
  {
    "id": "cap_world_countries_YEM",
    "packId": "world_countries",
    "parentItemId": "YEM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "沙那",
    "shortName": "沙那",
    "countyName": "亞洲",
    "townName": "葉門",
    "lat": 15.3694,
    "lng": 44.191,
    "aliases": [
      "薩那",
      "萨那",
      "亞丁",
      "Sanaa",
      "Sana'a"
    ]
  },
  {
    "id": "cap_world_countries_OMN",
    "packId": "world_countries",
    "parentItemId": "OMN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "馬斯喀特",
    "shortName": "馬斯喀特",
    "countyName": "亞洲",
    "townName": "阿曼",
    "lat": 23.588,
    "lng": 58.3829,
    "aliases": [
      "马斯喀特",
      "Muscat"
    ]
  },
  {
    "id": "cap_world_countries_ARE",
    "packId": "world_countries",
    "parentItemId": "ARE",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "阿布達比",
    "shortName": "阿布達比",
    "countyName": "亞洲",
    "townName": "阿拉伯聯合大公國",
    "lat": 24.4539,
    "lng": 54.3773,
    "aliases": [
      "阿布扎比",
      "Abu Dhabi"
    ]
  },
  {
    "id": "cap_world_countries_QAT",
    "packId": "world_countries",
    "parentItemId": "QAT",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "杜哈",
    "shortName": "杜哈",
    "countyName": "亞洲",
    "townName": "卡達",
    "lat": 25.2854,
    "lng": 51.531,
    "aliases": [
      "多哈",
      "Doha"
    ]
  },
  {
    "id": "cap_world_countries_BHR",
    "packId": "world_countries",
    "parentItemId": "BHR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "麥納瑪",
    "shortName": "麥納瑪",
    "countyName": "亞洲",
    "townName": "巴林",
    "lat": 26.2285,
    "lng": 50.586,
    "aliases": [
      "麥納麥",
      "麦纳麦",
      "Manama"
    ]
  },
  {
    "id": "cap_world_countries_KWT",
    "packId": "world_countries",
    "parentItemId": "KWT",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "科威特市",
    "shortName": "科威特市",
    "countyName": "亞洲",
    "townName": "科威特",
    "lat": 29.3759,
    "lng": 47.9774,
    "aliases": [
      "科威特",
      "科威特城",
      "Kuwait City",
      "Kuwait"
    ]
  },
  {
    "id": "cap_world_countries_TUR",
    "packId": "world_countries",
    "parentItemId": "TUR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "安卡拉",
    "shortName": "安卡拉",
    "countyName": "亞洲",
    "townName": "土耳其",
    "lat": 39.9334,
    "lng": 32.8597,
    "aliases": [
      "Ankara"
    ]
  },
  {
    "id": "cap_world_countries_CYP",
    "packId": "world_countries",
    "parentItemId": "CYP",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "尼古西亞",
    "shortName": "尼古西亞",
    "countyName": "亞洲",
    "townName": "賽普勒斯",
    "lat": 35.1856,
    "lng": 33.3823,
    "aliases": [
      "尼科西亞",
      "尼科西亚",
      "Nicosia"
    ]
  },
  {
    "id": "cap_world_countries_GEO",
    "packId": "world_countries",
    "parentItemId": "GEO",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "提比里斯",
    "shortName": "提比里斯",
    "countyName": "亞洲",
    "townName": "喬治亞",
    "lat": 41.7151,
    "lng": 44.8271,
    "aliases": [
      "第比利斯",
      "Tbilisi"
    ]
  },
  {
    "id": "cap_world_countries_ARM",
    "packId": "world_countries",
    "parentItemId": "ARM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "葉里溫",
    "shortName": "葉里溫",
    "countyName": "亞洲",
    "townName": "亞美尼亞",
    "lat": 40.1792,
    "lng": 44.4991,
    "aliases": [
      "埃里溫",
      "埃里温",
      "葉勒凡",
      "Yerevan"
    ]
  },
  {
    "id": "cap_world_countries_AZE",
    "packId": "world_countries",
    "parentItemId": "AZE",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "巴庫",
    "shortName": "巴庫",
    "countyName": "亞洲",
    "townName": "亞塞拜然",
    "lat": 40.4093,
    "lng": 49.8671,
    "aliases": [
      "巴库",
      "Baku"
    ]
  },
  {
    "id": "cap_world_countries_GBR",
    "packId": "world_countries",
    "parentItemId": "GBR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "倫敦",
    "shortName": "倫敦",
    "countyName": "歐洲",
    "townName": "英國",
    "lat": 51.5074,
    "lng": -0.1278,
    "aliases": [
      "伦敦",
      "London"
    ]
  },
  {
    "id": "cap_world_countries_IRL",
    "packId": "world_countries",
    "parentItemId": "IRL",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "都柏林",
    "shortName": "都柏林",
    "countyName": "歐洲",
    "townName": "愛爾蘭",
    "lat": 53.3498,
    "lng": -6.2603,
    "aliases": [
      "Dublin"
    ]
  },
  {
    "id": "cap_world_countries_ISL",
    "packId": "world_countries",
    "parentItemId": "ISL",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "雷克雅維克",
    "shortName": "雷克雅維克",
    "countyName": "歐洲",
    "townName": "冰島",
    "lat": 64.1466,
    "lng": -21.9426,
    "aliases": [
      "雷克雅未克",
      "Reykjavik",
      "Reykjavík"
    ]
  },
  {
    "id": "cap_world_countries_NOR",
    "packId": "world_countries",
    "parentItemId": "NOR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "奧斯陸",
    "shortName": "奧斯陸",
    "countyName": "歐洲",
    "townName": "挪威",
    "lat": 59.9139,
    "lng": 10.7522,
    "aliases": [
      "奥斯陆",
      "Oslo"
    ]
  },
  {
    "id": "cap_world_countries_SWE",
    "packId": "world_countries",
    "parentItemId": "SWE",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "斯德哥爾摩",
    "shortName": "斯德哥爾摩",
    "countyName": "歐洲",
    "townName": "瑞典",
    "lat": 59.3293,
    "lng": 18.0686,
    "aliases": [
      "斯德哥尔摩",
      "Stockholm"
    ]
  },
  {
    "id": "cap_world_countries_FIN",
    "packId": "world_countries",
    "parentItemId": "FIN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "赫爾辛基",
    "shortName": "赫爾辛基",
    "countyName": "歐洲",
    "townName": "芬蘭",
    "lat": 60.1699,
    "lng": 24.9384,
    "aliases": [
      "赫尔辛基",
      "Helsinki"
    ]
  },
  {
    "id": "cap_world_countries_DNK",
    "packId": "world_countries",
    "parentItemId": "DNK",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "哥本哈根",
    "shortName": "哥本哈根",
    "countyName": "歐洲",
    "townName": "丹麥",
    "lat": 55.6761,
    "lng": 12.5683,
    "aliases": [
      "Copenhagen"
    ]
  },
  {
    "id": "cap_world_countries_EST",
    "packId": "world_countries",
    "parentItemId": "EST",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "塔林",
    "shortName": "塔林",
    "countyName": "歐洲",
    "townName": "愛沙尼亞",
    "lat": 59.437,
    "lng": 24.7536,
    "aliases": [
      "Tallinn"
    ]
  },
  {
    "id": "cap_world_countries_LVA",
    "packId": "world_countries",
    "parentItemId": "LVA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "里加",
    "shortName": "里加",
    "countyName": "歐洲",
    "townName": "拉脫維亞",
    "lat": 56.9496,
    "lng": 24.1052,
    "aliases": [
      "Riga"
    ]
  },
  {
    "id": "cap_world_countries_LTU",
    "packId": "world_countries",
    "parentItemId": "LTU",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "維爾紐斯",
    "shortName": "維爾紐斯",
    "countyName": "歐洲",
    "townName": "立陶宛",
    "lat": 54.6872,
    "lng": 25.2797,
    "aliases": [
      "维尔纽斯",
      "Vilnius"
    ]
  },
  {
    "id": "cap_world_countries_FRA",
    "packId": "world_countries",
    "parentItemId": "FRA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "巴黎",
    "shortName": "巴黎",
    "countyName": "歐洲",
    "townName": "法國",
    "lat": 48.8566,
    "lng": 2.3522,
    "aliases": [
      "Paris"
    ]
  },
  {
    "id": "cap_world_countries_DEU",
    "packId": "world_countries",
    "parentItemId": "DEU",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "柏林",
    "shortName": "柏林",
    "countyName": "歐洲",
    "townName": "德國",
    "lat": 52.52,
    "lng": 13.405,
    "aliases": [
      "Berlin"
    ]
  },
  {
    "id": "cap_world_countries_NLD",
    "packId": "world_countries",
    "parentItemId": "NLD",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "阿姆斯特丹",
    "shortName": "阿姆斯特丹",
    "countyName": "歐洲",
    "townName": "荷蘭",
    "lat": 52.3676,
    "lng": 4.9041,
    "aliases": [
      "Amsterdam",
      "海牙",
      "The Hague"
    ]
  },
  {
    "id": "cap_world_countries_BEL",
    "packId": "world_countries",
    "parentItemId": "BEL",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "布魯塞爾",
    "shortName": "布魯塞爾",
    "countyName": "歐洲",
    "townName": "比利時",
    "lat": 50.8503,
    "lng": 4.3517,
    "aliases": [
      "布鲁塞尔",
      "Brussels"
    ]
  },
  {
    "id": "cap_world_countries_LUX",
    "packId": "world_countries",
    "parentItemId": "LUX",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "盧森堡",
    "shortName": "盧森堡",
    "countyName": "歐洲",
    "townName": "盧森堡",
    "lat": 49.6116,
    "lng": 6.1319,
    "aliases": [
      "盧森堡市",
      "卢森堡",
      "卢森堡市",
      "Luxembourg",
      "Luxembourg City"
    ]
  },
  {
    "id": "cap_world_countries_CHE",
    "packId": "world_countries",
    "parentItemId": "CHE",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "伯恩",
    "shortName": "伯恩",
    "countyName": "歐洲",
    "townName": "瑞士",
    "lat": 46.948,
    "lng": 7.4474,
    "aliases": [
      "伯爾尼",
      "伯尔尼",
      "Bern",
      "Berne"
    ]
  },
  {
    "id": "cap_world_countries_AUT",
    "packId": "world_countries",
    "parentItemId": "AUT",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "維也納",
    "shortName": "維也納",
    "countyName": "歐洲",
    "townName": "奧地利",
    "lat": 48.2082,
    "lng": 16.3738,
    "aliases": [
      "维也纳",
      "Vienna",
      "Wien"
    ]
  },
  {
    "id": "cap_world_countries_MCO",
    "packId": "world_countries",
    "parentItemId": "MCO",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "摩納哥",
    "shortName": "摩納哥",
    "countyName": "歐洲",
    "townName": "摩納哥",
    "lat": 43.7384,
    "lng": 7.4246,
    "aliases": [
      "摩納哥城",
      "摩纳哥",
      "Monaco"
    ]
  },
  {
    "id": "cap_world_countries_LIE",
    "packId": "world_countries",
    "parentItemId": "LIE",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "瓦都茲",
    "shortName": "瓦都茲",
    "countyName": "歐洲",
    "townName": "列支敦斯登",
    "lat": 47.141,
    "lng": 9.5209,
    "aliases": [
      "瓦杜茲",
      "瓦杜兹",
      "Vaduz"
    ]
  },
  {
    "id": "cap_world_countries_ESP",
    "packId": "world_countries",
    "parentItemId": "ESP",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "馬德里",
    "shortName": "馬德里",
    "countyName": "歐洲",
    "townName": "西班牙",
    "lat": 40.4168,
    "lng": -3.7038,
    "aliases": [
      "马德里",
      "Madrid"
    ]
  },
  {
    "id": "cap_world_countries_PRT",
    "packId": "world_countries",
    "parentItemId": "PRT",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "里斯本",
    "shortName": "里斯本",
    "countyName": "歐洲",
    "townName": "葡萄牙",
    "lat": 38.7223,
    "lng": -9.1393,
    "aliases": [
      "Lisbon",
      "Lisboa"
    ]
  },
  {
    "id": "cap_world_countries_AND",
    "packId": "world_countries",
    "parentItemId": "AND",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "安道爾城",
    "shortName": "安道爾城",
    "countyName": "歐洲",
    "townName": "安道爾",
    "lat": 42.5063,
    "lng": 1.5218,
    "aliases": [
      "安道爾",
      "安道尔城",
      "安道爾拉維拉",
      "Andorra la Vella",
      "Andorra"
    ]
  },
  {
    "id": "cap_world_countries_ITA",
    "packId": "world_countries",
    "parentItemId": "ITA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "羅馬",
    "shortName": "羅馬",
    "countyName": "歐洲",
    "townName": "義大利",
    "lat": 41.9028,
    "lng": 12.4964,
    "aliases": [
      "罗马",
      "Rome",
      "Roma"
    ]
  },
  {
    "id": "cap_world_countries_VAT",
    "packId": "world_countries",
    "parentItemId": "VAT",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "梵蒂岡",
    "shortName": "梵蒂岡",
    "countyName": "歐洲",
    "townName": "梵蒂岡",
    "lat": 41.9029,
    "lng": 12.4534,
    "aliases": [
      "梵蒂岡城",
      "梵蒂冈",
      "Vatican City",
      "Vatican"
    ]
  },
  {
    "id": "cap_world_countries_SMR",
    "packId": "world_countries",
    "parentItemId": "SMR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "聖馬利諾",
    "shortName": "聖馬利諾",
    "countyName": "歐洲",
    "townName": "聖馬利諾",
    "lat": 43.9356,
    "lng": 12.4473,
    "aliases": [
      "聖馬利諾市",
      "圣马力诺",
      "San Marino"
    ]
  },
  {
    "id": "cap_world_countries_MLT",
    "packId": "world_countries",
    "parentItemId": "MLT",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "瓦萊塔",
    "shortName": "瓦萊塔",
    "countyName": "歐洲",
    "townName": "馬爾他",
    "lat": 35.8989,
    "lng": 14.5146,
    "aliases": [
      "瓦莱塔",
      "法勒他",
      "Valletta"
    ]
  },
  {
    "id": "cap_world_countries_GRC",
    "packId": "world_countries",
    "parentItemId": "GRC",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "雅典",
    "shortName": "雅典",
    "countyName": "歐洲",
    "townName": "希臘",
    "lat": 37.9838,
    "lng": 23.7275,
    "aliases": [
      "Athens"
    ]
  },
  {
    "id": "cap_world_countries_SVN",
    "packId": "world_countries",
    "parentItemId": "SVN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "盧比安納",
    "shortName": "盧比安納",
    "countyName": "歐洲",
    "townName": "斯洛維尼亞",
    "lat": 46.0569,
    "lng": 14.5058,
    "aliases": [
      "盧布爾雅那",
      "卢布尔雅那",
      "Ljubljana"
    ]
  },
  {
    "id": "cap_world_countries_HRV",
    "packId": "world_countries",
    "parentItemId": "HRV",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "薩格勒布",
    "shortName": "薩格勒布",
    "countyName": "歐洲",
    "townName": "克羅埃西亞",
    "lat": 45.815,
    "lng": 15.9819,
    "aliases": [
      "札格瑞布",
      "扎格瑞布",
      "萨格勒布",
      "Zagreb"
    ]
  },
  {
    "id": "cap_world_countries_BIH",
    "packId": "world_countries",
    "parentItemId": "BIH",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "塞拉耶佛",
    "shortName": "塞拉耶佛",
    "countyName": "歐洲",
    "townName": "波士尼亞與赫塞哥維納",
    "lat": 43.8563,
    "lng": 18.4131,
    "aliases": [
      "薩拉熱窩",
      "萨拉热窝",
      "Sarajevo"
    ]
  },
  {
    "id": "cap_world_countries_SRB",
    "packId": "world_countries",
    "parentItemId": "SRB",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "貝爾格勒",
    "shortName": "貝爾格勒",
    "countyName": "歐洲",
    "townName": "塞爾維亞",
    "lat": 44.7866,
    "lng": 20.4489,
    "aliases": [
      "貝爾格萊德",
      "贝尔格莱德",
      "Belgrade"
    ]
  },
  {
    "id": "cap_world_countries_MNE",
    "packId": "world_countries",
    "parentItemId": "MNE",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "波德里查",
    "shortName": "波德里查",
    "countyName": "歐洲",
    "townName": "蒙特內哥羅",
    "lat": 42.4304,
    "lng": 19.2594,
    "aliases": [
      "波德戈里察",
      "Podgorica"
    ]
  },
  {
    "id": "cap_world_countries_MKD",
    "packId": "world_countries",
    "parentItemId": "MKD",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "史高比耶",
    "shortName": "史高比耶",
    "countyName": "歐洲",
    "townName": "北馬其頓",
    "lat": 41.9973,
    "lng": 21.428,
    "aliases": [
      "斯科普里",
      "Skopje"
    ]
  },
  {
    "id": "cap_world_countries_ALB",
    "packId": "world_countries",
    "parentItemId": "ALB",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "地拉那",
    "shortName": "地拉那",
    "countyName": "歐洲",
    "townName": "阿爾巴尼亞",
    "lat": 41.3275,
    "lng": 19.8187,
    "aliases": [
      "Tirana"
    ]
  },
  {
    "id": "cap_world_countries_POL",
    "packId": "world_countries",
    "parentItemId": "POL",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "華沙",
    "shortName": "華沙",
    "countyName": "歐洲",
    "townName": "波蘭",
    "lat": 52.2297,
    "lng": 21.0122,
    "aliases": [
      "华沙",
      "Warsaw",
      "Warszawa"
    ]
  },
  {
    "id": "cap_world_countries_CZE",
    "packId": "world_countries",
    "parentItemId": "CZE",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "布拉格",
    "shortName": "布拉格",
    "countyName": "歐洲",
    "townName": "捷克",
    "lat": 50.0755,
    "lng": 14.4378,
    "aliases": [
      "Prague",
      "Praha"
    ]
  },
  {
    "id": "cap_world_countries_SVK",
    "packId": "world_countries",
    "parentItemId": "SVK",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "布拉提斯拉瓦",
    "shortName": "布拉提斯拉瓦",
    "countyName": "歐洲",
    "townName": "斯洛伐克",
    "lat": 48.1486,
    "lng": 17.1077,
    "aliases": [
      "伯拉第斯拉瓦",
      "布拉迪斯拉發",
      "布拉迪斯拉发",
      "Bratislava"
    ]
  },
  {
    "id": "cap_world_countries_HUN",
    "packId": "world_countries",
    "parentItemId": "HUN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "布達佩斯",
    "shortName": "布達佩斯",
    "countyName": "歐洲",
    "townName": "匈牙利",
    "lat": 47.4979,
    "lng": 19.0402,
    "aliases": [
      "布达佩斯",
      "Budapest"
    ]
  },
  {
    "id": "cap_world_countries_ROU",
    "packId": "world_countries",
    "parentItemId": "ROU",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "布加勒斯特",
    "shortName": "布加勒斯特",
    "countyName": "歐洲",
    "townName": "羅馬尼亞",
    "lat": 44.4268,
    "lng": 26.1025,
    "aliases": [
      "Bucharest"
    ]
  },
  {
    "id": "cap_world_countries_BGR",
    "packId": "world_countries",
    "parentItemId": "BGR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "索菲亞",
    "shortName": "索菲亞",
    "countyName": "歐洲",
    "townName": "保加利亞",
    "lat": 42.6977,
    "lng": 23.3219,
    "aliases": [
      "索非亞",
      "索非亚",
      "Sofia"
    ]
  },
  {
    "id": "cap_world_countries_MDA",
    "packId": "world_countries",
    "parentItemId": "MDA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "基希訥烏",
    "shortName": "基希訥烏",
    "countyName": "歐洲",
    "townName": "摩爾多瓦",
    "lat": 47.0105,
    "lng": 28.8638,
    "aliases": [
      "奇西瑙",
      "基希讷乌",
      "Chisinau",
      "Chișinău"
    ]
  },
  {
    "id": "cap_world_countries_UKR",
    "packId": "world_countries",
    "parentItemId": "UKR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "基輔",
    "shortName": "基輔",
    "countyName": "歐洲",
    "townName": "烏克蘭",
    "lat": 50.4501,
    "lng": 30.5234,
    "aliases": [
      "基辅",
      "Kyiv",
      "Kiev"
    ]
  },
  {
    "id": "cap_world_countries_BLR",
    "packId": "world_countries",
    "parentItemId": "BLR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "明斯克",
    "shortName": "明斯克",
    "countyName": "歐洲",
    "townName": "白俄羅斯",
    "lat": 53.9006,
    "lng": 27.559,
    "aliases": [
      "Minsk"
    ]
  },
  {
    "id": "cap_world_countries_RUS",
    "packId": "world_countries",
    "parentItemId": "RUS",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "莫斯科",
    "shortName": "莫斯科",
    "countyName": "歐洲",
    "townName": "俄羅斯",
    "lat": 55.7558,
    "lng": 37.6173,
    "aliases": [
      "Moscow"
    ]
  },
  {
    "id": "cap_world_countries_EGY",
    "packId": "world_countries",
    "parentItemId": "EGY",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "開羅",
    "shortName": "開羅",
    "countyName": "非洲",
    "townName": "埃及",
    "lat": 30.0444,
    "lng": 31.2357,
    "aliases": [
      "开罗",
      "Cairo"
    ]
  },
  {
    "id": "cap_world_countries_LBY",
    "packId": "world_countries",
    "parentItemId": "LBY",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "的黎波里",
    "shortName": "的黎波里",
    "countyName": "非洲",
    "townName": "利比亞",
    "lat": 32.8872,
    "lng": 13.1913,
    "aliases": [
      "Tripoli"
    ]
  },
  {
    "id": "cap_world_countries_TUN",
    "packId": "world_countries",
    "parentItemId": "TUN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "突尼斯",
    "shortName": "突尼斯",
    "countyName": "非洲",
    "townName": "突尼西亞",
    "lat": 36.8065,
    "lng": 10.1815,
    "aliases": [
      "突尼西亞",
      "Tunis"
    ]
  },
  {
    "id": "cap_world_countries_DZA",
    "packId": "world_countries",
    "parentItemId": "DZA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "阿爾及爾",
    "shortName": "阿爾及爾",
    "countyName": "非洲",
    "townName": "阿爾及利亞",
    "lat": 36.7538,
    "lng": 3.0588,
    "aliases": [
      "阿尔及尔",
      "Algiers"
    ]
  },
  {
    "id": "cap_world_countries_MAR",
    "packId": "world_countries",
    "parentItemId": "MAR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "拉巴特",
    "shortName": "拉巴特",
    "countyName": "非洲",
    "townName": "摩洛哥",
    "lat": 34.0209,
    "lng": -6.8416,
    "aliases": [
      "Rabat"
    ]
  },
  {
    "id": "cap_world_countries_SDN",
    "packId": "world_countries",
    "parentItemId": "SDN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "喀土穆",
    "shortName": "喀土穆",
    "countyName": "非洲",
    "townName": "蘇丹",
    "lat": 15.5007,
    "lng": 32.5599,
    "aliases": [
      "Khartoum"
    ]
  },
  {
    "id": "cap_world_countries_MRT",
    "packId": "world_countries",
    "parentItemId": "MRT",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "諾克少",
    "shortName": "諾克少",
    "countyName": "非洲",
    "townName": "茅利塔尼亞",
    "lat": 18.0735,
    "lng": -15.9582,
    "aliases": [
      "努瓦克肖特",
      "諾克肖特",
      "Nouakchott"
    ]
  },
  {
    "id": "cap_world_countries_MLI",
    "packId": "world_countries",
    "parentItemId": "MLI",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "巴馬科",
    "shortName": "巴馬科",
    "countyName": "非洲",
    "townName": "馬利",
    "lat": 12.6392,
    "lng": -8.0029,
    "aliases": [
      "巴马科",
      "Bamako"
    ]
  },
  {
    "id": "cap_world_countries_NER",
    "packId": "world_countries",
    "parentItemId": "NER",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "尼阿美",
    "shortName": "尼阿美",
    "countyName": "非洲",
    "townName": "尼日",
    "lat": 13.5116,
    "lng": 2.1254,
    "aliases": [
      "尼亞美",
      "尼亚美",
      "Niamey"
    ]
  },
  {
    "id": "cap_world_countries_SEN",
    "packId": "world_countries",
    "parentItemId": "SEN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "達卡",
    "shortName": "達卡",
    "countyName": "非洲",
    "townName": "塞內加爾",
    "lat": 14.7167,
    "lng": -17.4677,
    "aliases": [
      "達喀爾",
      "达喀尔",
      "Dakar"
    ]
  },
  {
    "id": "cap_world_countries_GMB",
    "packId": "world_countries",
    "parentItemId": "GMB",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "班竹",
    "shortName": "班竹",
    "countyName": "非洲",
    "townName": "甘比亞",
    "lat": 13.4549,
    "lng": -16.579,
    "aliases": [
      "班珠爾",
      "班珠尔",
      "Banjul"
    ]
  },
  {
    "id": "cap_world_countries_GNB",
    "packId": "world_countries",
    "parentItemId": "GNB",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "比索",
    "shortName": "比索",
    "countyName": "非洲",
    "townName": "幾內亞比索",
    "lat": 11.8636,
    "lng": -15.5977,
    "aliases": [
      "比紹",
      "比绍",
      "Bissau"
    ]
  },
  {
    "id": "cap_world_countries_GIN",
    "packId": "world_countries",
    "parentItemId": "GIN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "柯那克里",
    "shortName": "柯那克里",
    "countyName": "非洲",
    "townName": "幾內亞",
    "lat": 9.6412,
    "lng": -13.5784,
    "aliases": [
      "科納克里",
      "科纳克里",
      "Conakry"
    ]
  },
  {
    "id": "cap_world_countries_SLE",
    "packId": "world_countries",
    "parentItemId": "SLE",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "自由城",
    "shortName": "自由城",
    "countyName": "非洲",
    "townName": "獅子山",
    "lat": 8.4657,
    "lng": -13.2317,
    "aliases": [
      "弗里敦",
      "Freetown"
    ]
  },
  {
    "id": "cap_world_countries_LBR",
    "packId": "world_countries",
    "parentItemId": "LBR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "蒙羅維亞",
    "shortName": "蒙羅維亞",
    "countyName": "非洲",
    "townName": "賴比瑞亞",
    "lat": 6.3156,
    "lng": -10.8074,
    "aliases": [
      "蒙罗维亚",
      "Monrovia"
    ]
  },
  {
    "id": "cap_world_countries_CIV",
    "packId": "world_countries",
    "parentItemId": "CIV",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "雅穆蘇克羅",
    "shortName": "雅穆蘇克羅",
    "countyName": "非洲",
    "townName": "象牙海岸",
    "lat": 6.8276,
    "lng": -5.2893,
    "aliases": [
      "亞穆蘇克羅",
      "亚穆苏克罗",
      "阿比尚",
      "阿比讓",
      "Yamoussoukro",
      "Abidjan"
    ]
  },
  {
    "id": "cap_world_countries_BFA",
    "packId": "world_countries",
    "parentItemId": "BFA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "瓦加杜古",
    "shortName": "瓦加杜古",
    "countyName": "非洲",
    "townName": "布吉納法索",
    "lat": 12.3714,
    "lng": -1.5197,
    "aliases": [
      "烏格都古",
      "Ouagadougou"
    ]
  },
  {
    "id": "cap_world_countries_GHA",
    "packId": "world_countries",
    "parentItemId": "GHA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "阿克拉",
    "shortName": "阿克拉",
    "countyName": "非洲",
    "townName": "迦納",
    "lat": 5.6037,
    "lng": -0.187,
    "aliases": [
      "Accra"
    ]
  },
  {
    "id": "cap_world_countries_TGO",
    "packId": "world_countries",
    "parentItemId": "TGO",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "洛美",
    "shortName": "洛美",
    "countyName": "非洲",
    "townName": "多哥",
    "lat": 6.1319,
    "lng": 1.2228,
    "aliases": [
      "Lome",
      "Lomé"
    ]
  },
  {
    "id": "cap_world_countries_BEN",
    "packId": "world_countries",
    "parentItemId": "BEN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "波多諾伏",
    "shortName": "波多諾伏",
    "countyName": "非洲",
    "townName": "貝南",
    "lat": 6.4969,
    "lng": 2.6289,
    "aliases": [
      "波多諾佛",
      "波多诺伏",
      "柯多努",
      "科托努",
      "Porto-Novo",
      "Cotonou"
    ]
  },
  {
    "id": "cap_world_countries_NGA",
    "packId": "world_countries",
    "parentItemId": "NGA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "阿布賈",
    "shortName": "阿布賈",
    "countyName": "非洲",
    "townName": "奈及利亞",
    "lat": 9.0765,
    "lng": 7.3986,
    "aliases": [
      "阿布贾",
      "阿布加",
      "Abuja"
    ]
  },
  {
    "id": "cap_world_countries_CPV",
    "packId": "world_countries",
    "parentItemId": "CPV",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "培亞",
    "shortName": "培亞",
    "countyName": "非洲",
    "townName": "維德角",
    "lat": 14.933,
    "lng": -23.5133,
    "aliases": [
      "普拉亞",
      "普拉亚",
      "Praia"
    ]
  },
  {
    "id": "cap_world_countries_TCD",
    "packId": "world_countries",
    "parentItemId": "TCD",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "恩將納",
    "shortName": "恩將納",
    "countyName": "非洲",
    "townName": "查德",
    "lat": 12.1348,
    "lng": 15.0557,
    "aliases": [
      "恩賈梅納",
      "恩贾梅纳",
      "N'Djamena",
      "Ndjamena"
    ]
  },
  {
    "id": "cap_world_countries_CAF",
    "packId": "world_countries",
    "parentItemId": "CAF",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "班基",
    "shortName": "班基",
    "countyName": "非洲",
    "townName": "中非共和國",
    "lat": 4.3947,
    "lng": 18.5582,
    "aliases": [
      "班吉",
      "Bangui"
    ]
  },
  {
    "id": "cap_world_countries_CMR",
    "packId": "world_countries",
    "parentItemId": "CMR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "雅溫德",
    "shortName": "雅溫德",
    "countyName": "非洲",
    "townName": "喀麥隆",
    "lat": 3.848,
    "lng": 11.5021,
    "aliases": [
      "雅溫得",
      "雅温得",
      "Yaounde",
      "Yaoundé"
    ]
  },
  {
    "id": "cap_world_countries_GNQ",
    "packId": "world_countries",
    "parentItemId": "GNQ",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "馬拉博",
    "shortName": "馬拉博",
    "countyName": "非洲",
    "townName": "赤道幾內亞",
    "lat": 3.7504,
    "lng": 8.7371,
    "aliases": [
      "马拉博",
      "Malabo"
    ]
  },
  {
    "id": "cap_world_countries_GAB",
    "packId": "world_countries",
    "parentItemId": "GAB",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "自由市",
    "shortName": "自由市",
    "countyName": "非洲",
    "townName": "加彭",
    "lat": 0.4162,
    "lng": 9.4673,
    "aliases": [
      "利伯維爾",
      "利伯维尔",
      "Libreville"
    ]
  },
  {
    "id": "cap_world_countries_COG",
    "packId": "world_countries",
    "parentItemId": "COG",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "布拉薩",
    "shortName": "布拉薩",
    "countyName": "非洲",
    "townName": "剛果共和國",
    "lat": -4.2634,
    "lng": 15.2429,
    "aliases": [
      "布拉柴維爾",
      "布拉柴维尔",
      "布拉薩市",
      "Brazzaville"
    ]
  },
  {
    "id": "cap_world_countries_COD",
    "packId": "world_countries",
    "parentItemId": "COD",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "金夏沙",
    "shortName": "金夏沙",
    "countyName": "非洲",
    "townName": "剛果民主共和國",
    "lat": -4.4419,
    "lng": 15.2663,
    "aliases": [
      "金沙薩",
      "金沙萨",
      "Kinshasa"
    ]
  },
  {
    "id": "cap_world_countries_STP",
    "packId": "world_countries",
    "parentItemId": "STP",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "聖多美",
    "shortName": "聖多美",
    "countyName": "非洲",
    "townName": "聖多美普林西比",
    "lat": 0.3365,
    "lng": 6.7273,
    "aliases": [
      "圣多美",
      "Sao Tome",
      "São Tomé"
    ]
  },
  {
    "id": "cap_world_countries_AGO",
    "packId": "world_countries",
    "parentItemId": "AGO",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "魯安達",
    "shortName": "魯安達",
    "countyName": "非洲",
    "townName": "安哥拉",
    "lat": -8.839,
    "lng": 13.2894,
    "aliases": [
      "羅安達",
      "罗安达",
      "Luanda"
    ]
  },
  {
    "id": "cap_world_countries_SSD",
    "packId": "world_countries",
    "parentItemId": "SSD",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "朱巴",
    "shortName": "朱巴",
    "countyName": "非洲",
    "townName": "南蘇丹",
    "lat": 4.8594,
    "lng": 31.5713,
    "aliases": [
      "Juba"
    ]
  },
  {
    "id": "cap_world_countries_ERI",
    "packId": "world_countries",
    "parentItemId": "ERI",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "阿斯馬拉",
    "shortName": "阿斯馬拉",
    "countyName": "非洲",
    "townName": "厄利垂亞",
    "lat": 15.3229,
    "lng": 38.9251,
    "aliases": [
      "阿斯瑪拉",
      "阿斯马拉",
      "Asmara"
    ]
  },
  {
    "id": "cap_world_countries_ETH",
    "packId": "world_countries",
    "parentItemId": "ETH",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "阿迪斯阿貝巴",
    "shortName": "阿迪斯阿貝巴",
    "countyName": "非洲",
    "townName": "衣索比亞",
    "lat": 9.032,
    "lng": 38.7469,
    "aliases": [
      "亞的斯亞貝巴",
      "亚的斯亚贝巴",
      "Addis Ababa"
    ]
  },
  {
    "id": "cap_world_countries_DJI",
    "packId": "world_countries",
    "parentItemId": "DJI",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "吉布地",
    "shortName": "吉布地",
    "countyName": "非洲",
    "townName": "吉布地",
    "lat": 11.5721,
    "lng": 43.1456,
    "aliases": [
      "吉布地市",
      "吉布提",
      "吉布提市",
      "Djibouti"
    ]
  },
  {
    "id": "cap_world_countries_SOM",
    "packId": "world_countries",
    "parentItemId": "SOM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "摩加迪休",
    "shortName": "摩加迪休",
    "countyName": "非洲",
    "townName": "索馬利亞",
    "lat": 2.0469,
    "lng": 45.3182,
    "aliases": [
      "摩加迪沙",
      "Mogadishu"
    ]
  },
  {
    "id": "cap_world_countries_KEN",
    "packId": "world_countries",
    "parentItemId": "KEN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "奈洛比",
    "shortName": "奈洛比",
    "countyName": "非洲",
    "townName": "肯亞",
    "lat": -1.2921,
    "lng": 36.8219,
    "aliases": [
      "內羅畢",
      "内罗毕",
      "Nairobi"
    ]
  },
  {
    "id": "cap_world_countries_UGA",
    "packId": "world_countries",
    "parentItemId": "UGA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "坎帕拉",
    "shortName": "坎帕拉",
    "countyName": "非洲",
    "townName": "烏干達",
    "lat": 0.3476,
    "lng": 32.5825,
    "aliases": [
      "Kampala"
    ]
  },
  {
    "id": "cap_world_countries_RWA",
    "packId": "world_countries",
    "parentItemId": "RWA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "吉佳利",
    "shortName": "吉佳利",
    "countyName": "非洲",
    "townName": "盧安達",
    "lat": -1.9441,
    "lng": 30.0619,
    "aliases": [
      "基加利",
      "Kigali"
    ]
  },
  {
    "id": "cap_world_countries_BDI",
    "packId": "world_countries",
    "parentItemId": "BDI",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "基特加",
    "shortName": "基特加",
    "countyName": "非洲",
    "townName": "蒲隆地",
    "lat": -3.4271,
    "lng": 29.9246,
    "aliases": [
      "吉特加",
      "布瓊布拉",
      "布琼布拉",
      "Gitega",
      "Bujumbura"
    ]
  },
  {
    "id": "cap_world_countries_TZA",
    "packId": "world_countries",
    "parentItemId": "TZA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "杜篤瑪",
    "shortName": "杜篤瑪",
    "countyName": "非洲",
    "townName": "坦尚尼亞",
    "lat": -6.163,
    "lng": 35.7516,
    "aliases": [
      "多多馬",
      "多多马",
      "三蘭港",
      "達累斯薩拉姆",
      "Dodoma",
      "Dar es Salaam"
    ]
  },
  {
    "id": "cap_world_countries_ZMB",
    "packId": "world_countries",
    "parentItemId": "ZMB",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "路沙卡",
    "shortName": "路沙卡",
    "countyName": "非洲",
    "townName": "尚比亞",
    "lat": -15.3875,
    "lng": 28.3228,
    "aliases": [
      "盧薩卡",
      "卢萨卡",
      "Lusaka"
    ]
  },
  {
    "id": "cap_world_countries_MWI",
    "packId": "world_countries",
    "parentItemId": "MWI",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "里朗威",
    "shortName": "里朗威",
    "countyName": "非洲",
    "townName": "馬拉威",
    "lat": -13.9626,
    "lng": 33.7741,
    "aliases": [
      "利隆圭",
      "Lilongwe"
    ]
  },
  {
    "id": "cap_world_countries_MOZ",
    "packId": "world_countries",
    "parentItemId": "MOZ",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "馬布多",
    "shortName": "馬布多",
    "countyName": "非洲",
    "townName": "莫三比克",
    "lat": -25.9692,
    "lng": 32.5732,
    "aliases": [
      "馬普托",
      "马普托",
      "Maputo"
    ]
  },
  {
    "id": "cap_world_countries_ZWE",
    "packId": "world_countries",
    "parentItemId": "ZWE",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "哈拉雷",
    "shortName": "哈拉雷",
    "countyName": "非洲",
    "townName": "辛巴威",
    "lat": -17.8252,
    "lng": 31.0335,
    "aliases": [
      "Harare"
    ]
  },
  {
    "id": "cap_world_countries_MDG",
    "packId": "world_countries",
    "parentItemId": "MDG",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "安塔那那利佛",
    "shortName": "安塔那那利佛",
    "countyName": "非洲",
    "townName": "馬達加斯加",
    "lat": -18.8792,
    "lng": 47.5079,
    "aliases": [
      "安塔那那利弗",
      "塔那那利佛",
      "Antananarivo"
    ]
  },
  {
    "id": "cap_world_countries_COM",
    "packId": "world_countries",
    "parentItemId": "COM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "莫洛尼",
    "shortName": "莫洛尼",
    "countyName": "非洲",
    "townName": "葛摩",
    "lat": -11.7172,
    "lng": 43.2473,
    "aliases": [
      "莫羅尼",
      "莫罗尼",
      "Moroni"
    ]
  },
  {
    "id": "cap_world_countries_MUS",
    "packId": "world_countries",
    "parentItemId": "MUS",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "路易士港",
    "shortName": "路易士港",
    "countyName": "非洲",
    "townName": "模里西斯",
    "lat": -20.1609,
    "lng": 57.5012,
    "aliases": [
      "路易港",
      "Port Louis"
    ]
  },
  {
    "id": "cap_world_countries_SYC",
    "packId": "world_countries",
    "parentItemId": "SYC",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "維多利亞",
    "shortName": "維多利亞",
    "countyName": "非洲",
    "townName": "塞席爾",
    "lat": -4.6191,
    "lng": 55.4513,
    "aliases": [
      "维多利亚",
      "Victoria"
    ]
  },
  {
    "id": "cap_world_countries_NAM",
    "packId": "world_countries",
    "parentItemId": "NAM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "溫荷克",
    "shortName": "溫荷克",
    "countyName": "非洲",
    "townName": "納米比亞",
    "lat": -22.5609,
    "lng": 17.0658,
    "aliases": [
      "溫得和克",
      "温得和克",
      "Windhoek"
    ]
  },
  {
    "id": "cap_world_countries_BWA",
    "packId": "world_countries",
    "parentItemId": "BWA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "嘉柏隆里",
    "shortName": "嘉柏隆里",
    "countyName": "非洲",
    "townName": "波札那",
    "lat": -24.6282,
    "lng": 25.9231,
    "aliases": [
      "哈博羅內",
      "哈博罗内",
      "Gaborone"
    ]
  },
  {
    "id": "cap_world_countries_ZAF",
    "packId": "world_countries",
    "parentItemId": "ZAF",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "普勒托利亞",
    "shortName": "普勒托利亞",
    "countyName": "非洲",
    "townName": "南非",
    "lat": -25.7479,
    "lng": 28.2293,
    "aliases": [
      "比勒陀利亞",
      "比勒陀利亚",
      "開普敦",
      "开普敦",
      "布隆泉",
      "Pretoria",
      "Cape Town",
      "Bloemfontein"
    ]
  },
  {
    "id": "cap_world_countries_LSO",
    "packId": "world_countries",
    "parentItemId": "LSO",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "馬塞魯",
    "shortName": "馬塞魯",
    "countyName": "非洲",
    "townName": "賴索托",
    "lat": -29.3151,
    "lng": 27.4869,
    "aliases": [
      "马塞卢",
      "Maseru"
    ]
  },
  {
    "id": "cap_world_countries_SWZ",
    "packId": "world_countries",
    "parentItemId": "SWZ",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "墨巴本",
    "shortName": "墨巴本",
    "countyName": "非洲",
    "townName": "史瓦帝尼",
    "lat": -26.3054,
    "lng": 31.1367,
    "aliases": [
      "姆巴巴內",
      "姆巴巴内",
      "姆巴巴納",
      "洛班巴",
      "Mbabane",
      "Lobamba"
    ]
  },
  {
    "id": "cap_world_countries_USA",
    "packId": "world_countries",
    "parentItemId": "USA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "華盛頓",
    "shortName": "華盛頓",
    "countyName": "北美洲",
    "townName": "美國",
    "lat": 38.9072,
    "lng": -77.0369,
    "aliases": [
      "華盛頓特區",
      "華盛頓哥倫比亞特區",
      "华盛顿",
      "华盛顿特区",
      "Washington",
      "Washington DC",
      "Washington, D.C."
    ]
  },
  {
    "id": "cap_world_countries_CAN",
    "packId": "world_countries",
    "parentItemId": "CAN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "渥太華",
    "shortName": "渥太華",
    "countyName": "北美洲",
    "townName": "加拿大",
    "lat": 45.4215,
    "lng": -75.6972,
    "aliases": [
      "渥太华",
      "鄂圖瓦",
      "Ottawa"
    ]
  },
  {
    "id": "cap_world_countries_MEX",
    "packId": "world_countries",
    "parentItemId": "MEX",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "墨西哥城",
    "shortName": "墨西哥城",
    "countyName": "北美洲",
    "townName": "墨西哥",
    "lat": 19.4326,
    "lng": -99.1332,
    "aliases": [
      "墨西哥市",
      "Mexico City"
    ]
  },
  {
    "id": "cap_world_countries_BLZ",
    "packId": "world_countries",
    "parentItemId": "BLZ",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "貝爾墨潘",
    "shortName": "貝爾墨潘",
    "countyName": "北美洲",
    "townName": "貝里斯",
    "lat": 17.251,
    "lng": -88.759,
    "aliases": [
      "貝爾莫潘",
      "贝尔莫潘",
      "Belmopan"
    ]
  },
  {
    "id": "cap_world_countries_GTM",
    "packId": "world_countries",
    "parentItemId": "GTM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "瓜地馬拉市",
    "shortName": "瓜地馬拉市",
    "countyName": "北美洲",
    "townName": "瓜地馬拉",
    "lat": 14.6349,
    "lng": -90.5069,
    "aliases": [
      "瓜地馬拉城",
      "危地馬拉城",
      "危地马拉城",
      "Guatemala City"
    ]
  },
  {
    "id": "cap_world_countries_HND",
    "packId": "world_countries",
    "parentItemId": "HND",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "德古西加巴",
    "shortName": "德古西加巴",
    "countyName": "北美洲",
    "townName": "宏都拉斯",
    "lat": 14.0723,
    "lng": -87.1921,
    "aliases": [
      "特古西加爾巴",
      "特古西加尔巴",
      "Tegucigalpa"
    ]
  },
  {
    "id": "cap_world_countries_SLV",
    "packId": "world_countries",
    "parentItemId": "SLV",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "聖薩爾瓦多",
    "shortName": "聖薩爾瓦多",
    "countyName": "北美洲",
    "townName": "薩爾瓦多",
    "lat": 13.6929,
    "lng": -89.2182,
    "aliases": [
      "圣萨尔瓦多",
      "San Salvador"
    ]
  },
  {
    "id": "cap_world_countries_NIC",
    "packId": "world_countries",
    "parentItemId": "NIC",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "馬拿瓜",
    "shortName": "馬拿瓜",
    "countyName": "北美洲",
    "townName": "尼加拉瓜",
    "lat": 12.115,
    "lng": -86.2362,
    "aliases": [
      "馬那瓜",
      "马那瓜",
      "Managua"
    ]
  },
  {
    "id": "cap_world_countries_CRI",
    "packId": "world_countries",
    "parentItemId": "CRI",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "聖荷西",
    "shortName": "聖荷西",
    "countyName": "北美洲",
    "townName": "哥斯大黎加",
    "lat": 9.9281,
    "lng": -84.0907,
    "aliases": [
      "聖何塞",
      "圣何塞",
      "San Jose",
      "San José"
    ]
  },
  {
    "id": "cap_world_countries_PAN",
    "packId": "world_countries",
    "parentItemId": "PAN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "巴拿馬市",
    "shortName": "巴拿馬市",
    "countyName": "北美洲",
    "townName": "巴拿馬",
    "lat": 8.9824,
    "lng": -79.5199,
    "aliases": [
      "巴拿馬城",
      "巴拿马城",
      "Panama City"
    ]
  },
  {
    "id": "cap_world_countries_CUB",
    "packId": "world_countries",
    "parentItemId": "CUB",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "哈瓦那",
    "shortName": "哈瓦那",
    "countyName": "北美洲",
    "townName": "古巴",
    "lat": 23.1136,
    "lng": -82.3666,
    "aliases": [
      "Havana"
    ]
  },
  {
    "id": "cap_world_countries_JAM",
    "packId": "world_countries",
    "parentItemId": "JAM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "京斯敦",
    "shortName": "京斯敦",
    "countyName": "北美洲",
    "townName": "牙買加",
    "lat": 17.9712,
    "lng": -76.7936,
    "aliases": [
      "金斯敦",
      "金斯頓",
      "Kingston"
    ]
  },
  {
    "id": "cap_world_countries_HTI",
    "packId": "world_countries",
    "parentItemId": "HTI",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "太子港",
    "shortName": "太子港",
    "countyName": "北美洲",
    "townName": "海地",
    "lat": 18.5944,
    "lng": -72.3074,
    "aliases": [
      "Port-au-Prince"
    ]
  },
  {
    "id": "cap_world_countries_DOM",
    "packId": "world_countries",
    "parentItemId": "DOM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "聖多明哥",
    "shortName": "聖多明哥",
    "countyName": "北美洲",
    "townName": "多明尼加",
    "lat": 18.4861,
    "lng": -69.9312,
    "aliases": [
      "聖多明各",
      "圣多明各",
      "Santo Domingo"
    ]
  },
  {
    "id": "cap_world_countries_BHS",
    "packId": "world_countries",
    "parentItemId": "BHS",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "拿索",
    "shortName": "拿索",
    "countyName": "北美洲",
    "townName": "巴哈馬",
    "lat": 25.0443,
    "lng": -77.3504,
    "aliases": [
      "拿騷",
      "拿骚",
      "Nassau"
    ]
  },
  {
    "id": "cap_world_countries_KNA",
    "packId": "world_countries",
    "parentItemId": "KNA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "巴斯特爾",
    "shortName": "巴斯特爾",
    "countyName": "北美洲",
    "townName": "聖克里斯多福及尼維斯",
    "lat": 17.3026,
    "lng": -62.7177,
    "aliases": [
      "巴斯地",
      "巴斯特尔",
      "Basseterre"
    ]
  },
  {
    "id": "cap_world_countries_ATG",
    "packId": "world_countries",
    "parentItemId": "ATG",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "聖約翰",
    "shortName": "聖約翰",
    "countyName": "北美洲",
    "townName": "安地卡及巴布達",
    "lat": 17.1274,
    "lng": -61.8468,
    "aliases": [
      "圣约翰",
      "聖約翰斯",
      "St. John's",
      "Saint John's"
    ]
  },
  {
    "id": "cap_world_countries_DMA",
    "packId": "world_countries",
    "parentItemId": "DMA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "羅索",
    "shortName": "羅索",
    "countyName": "北美洲",
    "townName": "多米尼克",
    "lat": 15.3017,
    "lng": -61.3881,
    "aliases": [
      "罗索",
      "Roseau"
    ]
  },
  {
    "id": "cap_world_countries_LCA",
    "packId": "world_countries",
    "parentItemId": "LCA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "卡斯特里",
    "shortName": "卡斯特里",
    "countyName": "北美洲",
    "townName": "聖露西亞",
    "lat": 14.0101,
    "lng": -60.9875,
    "aliases": [
      "卡斯翠",
      "Castries"
    ]
  },
  {
    "id": "cap_world_countries_VCT",
    "packId": "world_countries",
    "parentItemId": "VCT",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "金斯敦",
    "shortName": "金斯敦",
    "countyName": "北美洲",
    "townName": "聖文森及格瑞那丁",
    "lat": 13.1587,
    "lng": -61.2248,
    "aliases": [
      "金斯頓",
      "金斯敦港",
      "Kingstown"
    ]
  },
  {
    "id": "cap_world_countries_BRB",
    "packId": "world_countries",
    "parentItemId": "BRB",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "橋鎮",
    "shortName": "橋鎮",
    "countyName": "北美洲",
    "townName": "巴貝多",
    "lat": 13.0969,
    "lng": -59.6145,
    "aliases": [
      "布里奇敦",
      "桥镇",
      "Bridgetown"
    ]
  },
  {
    "id": "cap_world_countries_GRD",
    "packId": "world_countries",
    "parentItemId": "GRD",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "聖喬治",
    "shortName": "聖喬治",
    "countyName": "北美洲",
    "townName": "格瑞那達",
    "lat": 12.0561,
    "lng": -61.7488,
    "aliases": [
      "圣乔治",
      "St. George's",
      "Saint George's"
    ]
  },
  {
    "id": "cap_world_countries_TTO",
    "packId": "world_countries",
    "parentItemId": "TTO",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "西班牙港",
    "shortName": "西班牙港",
    "countyName": "北美洲",
    "townName": "千里達及托巴哥",
    "lat": 10.6549,
    "lng": -61.5019,
    "aliases": [
      "Port of Spain"
    ]
  },
  {
    "id": "cap_world_countries_COL",
    "packId": "world_countries",
    "parentItemId": "COL",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "波哥大",
    "shortName": "波哥大",
    "countyName": "南美洲",
    "townName": "哥倫比亞",
    "lat": 4.711,
    "lng": -74.0721,
    "aliases": [
      "Bogota",
      "Bogotá"
    ]
  },
  {
    "id": "cap_world_countries_VEN",
    "packId": "world_countries",
    "parentItemId": "VEN",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "卡拉卡斯",
    "shortName": "卡拉卡斯",
    "countyName": "南美洲",
    "townName": "委內瑞拉",
    "lat": 10.4806,
    "lng": -66.9036,
    "aliases": [
      "加拉加斯",
      "Caracas"
    ]
  },
  {
    "id": "cap_world_countries_GUY",
    "packId": "world_countries",
    "parentItemId": "GUY",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "喬治敦",
    "shortName": "喬治敦",
    "countyName": "南美洲",
    "townName": "蓋亞那",
    "lat": 6.8013,
    "lng": -58.1551,
    "aliases": [
      "喬治鎮",
      "乔治敦",
      "Georgetown"
    ]
  },
  {
    "id": "cap_world_countries_SUR",
    "packId": "world_countries",
    "parentItemId": "SUR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "巴拉馬利波",
    "shortName": "巴拉馬利波",
    "countyName": "南美洲",
    "townName": "蘇利南",
    "lat": 5.852,
    "lng": -55.2038,
    "aliases": [
      "帕拉馬里博",
      "帕拉马里博",
      "Paramaribo"
    ]
  },
  {
    "id": "cap_world_countries_BRA",
    "packId": "world_countries",
    "parentItemId": "BRA",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "巴西利亞",
    "shortName": "巴西利亞",
    "countyName": "南美洲",
    "townName": "巴西",
    "lat": -15.7975,
    "lng": -47.8919,
    "aliases": [
      "巴西利亚",
      "Brasilia",
      "Brasília"
    ]
  },
  {
    "id": "cap_world_countries_ECU",
    "packId": "world_countries",
    "parentItemId": "ECU",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "基多",
    "shortName": "基多",
    "countyName": "南美洲",
    "townName": "厄瓜多",
    "lat": -0.1807,
    "lng": -78.4678,
    "aliases": [
      "Quito"
    ]
  },
  {
    "id": "cap_world_countries_PER",
    "packId": "world_countries",
    "parentItemId": "PER",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "利馬",
    "shortName": "利馬",
    "countyName": "南美洲",
    "townName": "秘魯",
    "lat": -12.0464,
    "lng": -77.0428,
    "aliases": [
      "利马",
      "Lima"
    ]
  },
  {
    "id": "cap_world_countries_BOL",
    "packId": "world_countries",
    "parentItemId": "BOL",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "蘇克雷",
    "shortName": "蘇克雷",
    "countyName": "南美洲",
    "townName": "玻利維亞",
    "lat": -19.0196,
    "lng": -65.2619,
    "aliases": [
      "苏克雷",
      "拉巴斯",
      "Sucre",
      "La Paz"
    ]
  },
  {
    "id": "cap_world_countries_PRY",
    "packId": "world_countries",
    "parentItemId": "PRY",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "亞松森",
    "shortName": "亞松森",
    "countyName": "南美洲",
    "townName": "巴拉圭",
    "lat": -25.2637,
    "lng": -57.5759,
    "aliases": [
      "亚松森",
      "Asuncion",
      "Asunción"
    ]
  },
  {
    "id": "cap_world_countries_URY",
    "packId": "world_countries",
    "parentItemId": "URY",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "蒙特維多",
    "shortName": "蒙特維多",
    "countyName": "南美洲",
    "townName": "烏拉圭",
    "lat": -34.9011,
    "lng": -56.1645,
    "aliases": [
      "蒙得維的亞",
      "蒙得维的亚",
      "Montevideo"
    ]
  },
  {
    "id": "cap_world_countries_ARG",
    "packId": "world_countries",
    "parentItemId": "ARG",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "布宜諾斯艾利斯",
    "shortName": "布宜諾斯艾利斯",
    "countyName": "南美洲",
    "townName": "阿根廷",
    "lat": -34.6037,
    "lng": -58.3816,
    "aliases": [
      "布宜諾斯愛麗絲",
      "Buenos Aires"
    ]
  },
  {
    "id": "cap_world_countries_CHL",
    "packId": "world_countries",
    "parentItemId": "CHL",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "聖地牙哥",
    "shortName": "聖地牙哥",
    "countyName": "南美洲",
    "townName": "智利",
    "lat": -33.4489,
    "lng": -70.6693,
    "aliases": [
      "聖地亞哥",
      "圣地亚哥",
      "Santiago"
    ]
  },
  {
    "id": "cap_world_countries_AUS",
    "packId": "world_countries",
    "parentItemId": "AUS",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "坎培拉",
    "shortName": "坎培拉",
    "countyName": "大洋洲",
    "townName": "澳洲",
    "lat": -35.2809,
    "lng": 149.13,
    "aliases": [
      "堪培拉",
      "Canberra"
    ]
  },
  {
    "id": "cap_world_countries_NZL",
    "packId": "world_countries",
    "parentItemId": "NZL",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "威靈頓",
    "shortName": "威靈頓",
    "countyName": "大洋洲",
    "townName": "紐西蘭",
    "lat": -41.2865,
    "lng": 174.7762,
    "aliases": [
      "惠靈頓",
      "惠灵顿",
      "Wellington"
    ]
  },
  {
    "id": "cap_world_countries_PNG",
    "packId": "world_countries",
    "parentItemId": "PNG",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "莫士比港",
    "shortName": "莫士比港",
    "countyName": "大洋洲",
    "townName": "巴布亞紐幾內亞",
    "lat": -9.4438,
    "lng": 147.1803,
    "aliases": [
      "莫爾茲比港",
      "莫尔兹比港",
      "Port Moresby"
    ]
  },
  {
    "id": "cap_world_countries_FJI",
    "packId": "world_countries",
    "parentItemId": "FJI",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "蘇瓦",
    "shortName": "蘇瓦",
    "countyName": "大洋洲",
    "townName": "斐濟",
    "lat": -18.1416,
    "lng": 178.4419,
    "aliases": [
      "苏瓦",
      "Suva"
    ]
  },
  {
    "id": "cap_world_countries_SLB",
    "packId": "world_countries",
    "parentItemId": "SLB",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "荷尼阿拉",
    "shortName": "荷尼阿拉",
    "countyName": "大洋洲",
    "townName": "索羅門群島",
    "lat": -9.4456,
    "lng": 159.9729,
    "aliases": [
      "霍尼亞拉",
      "霍尼亚拉",
      "Honiara"
    ]
  },
  {
    "id": "cap_world_countries_VUT",
    "packId": "world_countries",
    "parentItemId": "VUT",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "維拉港",
    "shortName": "維拉港",
    "countyName": "大洋洲",
    "townName": "萬那杜",
    "lat": -17.7333,
    "lng": 168.3273,
    "aliases": [
      "维拉港",
      "Port Vila"
    ]
  },
  {
    "id": "cap_world_countries_WSM",
    "packId": "world_countries",
    "parentItemId": "WSM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "阿庇亞",
    "shortName": "阿庇亞",
    "countyName": "大洋洲",
    "townName": "薩摩亞",
    "lat": -13.8333,
    "lng": -171.7667,
    "aliases": [
      "阿皮亞",
      "阿皮亚",
      "Apia"
    ]
  },
  {
    "id": "cap_world_countries_TON",
    "packId": "world_countries",
    "parentItemId": "TON",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "努瓜婁發",
    "shortName": "努瓜婁發",
    "countyName": "大洋洲",
    "townName": "東加",
    "lat": -21.1393,
    "lng": -175.2049,
    "aliases": [
      "努庫阿洛法",
      "努库阿洛法",
      "Nuku'alofa",
      "Nukualofa"
    ]
  },
  {
    "id": "cap_world_countries_KIR",
    "packId": "world_countries",
    "parentItemId": "KIR",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "塔拉瓦",
    "shortName": "塔拉瓦",
    "countyName": "大洋洲",
    "townName": "吉里巴斯",
    "lat": 1.3291,
    "lng": 172.979,
    "aliases": [
      "南塔拉瓦",
      "Tarawa",
      "South Tarawa"
    ]
  },
  {
    "id": "cap_world_countries_FSM",
    "packId": "world_countries",
    "parentItemId": "FSM",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "帕利基爾",
    "shortName": "帕利基爾",
    "countyName": "大洋洲",
    "townName": "密克羅尼西亞",
    "lat": 6.9248,
    "lng": 158.1611,
    "aliases": [
      "帕利基尔",
      "Palikir"
    ]
  },
  {
    "id": "cap_world_countries_MHL",
    "packId": "world_countries",
    "parentItemId": "MHL",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "馬久羅",
    "shortName": "馬久羅",
    "countyName": "大洋洲",
    "townName": "馬紹爾群島",
    "lat": 7.0897,
    "lng": 171.3803,
    "aliases": [
      "馬朱羅",
      "马朱罗",
      "Majuro"
    ]
  },
  {
    "id": "cap_world_countries_PLW",
    "packId": "world_countries",
    "parentItemId": "PLW",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "恩吉魯穆德",
    "shortName": "恩吉魯穆德",
    "countyName": "大洋洲",
    "townName": "帛琉",
    "lat": 7.5006,
    "lng": 134.6242,
    "aliases": [
      "梅萊凱奧克",
      "梅莱凯奥克",
      "柯羅",
      "Ngerulmud",
      "Melekeok",
      "Koror"
    ]
  },
  {
    "id": "cap_world_countries_NRU",
    "packId": "world_countries",
    "parentItemId": "NRU",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "亞倫",
    "shortName": "亞倫",
    "countyName": "大洋洲",
    "townName": "諾魯",
    "lat": -0.5477,
    "lng": 166.9209,
    "aliases": [
      "雅連",
      "亚伦",
      "Yaren"
    ]
  },
  {
    "id": "cap_world_countries_TUV",
    "packId": "world_countries",
    "parentItemId": "TUV",
    "category": "capital",
    "subTypes": [
      "national_capital"
    ],
    "name": "富納富提",
    "shortName": "富納富提",
    "countyName": "大洋洲",
    "townName": "吐瓦魯",
    "lat": -8.5211,
    "lng": 179.1962,
    "aliases": [
      "富纳富提",
      "Funafuti"
    ]
  }
];

const CAPITAL_POI_BY_ID = new Map(CAPITAL_POI_DATA.map((p) => [p.id, p]));

const CAPITAL_POIS_BY_PACK = CAPITAL_POI_DATA.reduce((acc, p) => {
  if (!acc[p.packId]) acc[p.packId] = [];
  acc[p.packId].push(p);
  return acc;
}, Object.create(null));

function getCapitalPoisForPack(packId) {
  return CAPITAL_POIS_BY_PACK[packId] || [];
}

function getCapitalTopicLabelForPack(pack) {
  if (!pack) return '首都／省會';
  if (pack.features && pack.features.capitalLabel) return pack.features.capitalLabel;
  if (pack.id === 'world_countries') return '首都';
  if (pack.id === 'cn_prov' || pack.id === 'roc_1949') return '省會';
  if (Array.isArray(pack.memberPackIds)) {
    if (pack.memberPackIds.includes('world_countries')) return '首都';
    if (pack.memberPackIds.includes('cn_prov') || pack.memberPackIds.includes('roc_1949')) return '省會';
  }
  return '首都／省會';
}
