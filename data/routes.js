/**
 * 研学路线数据：按顺序串联点位，供「小地图」查看线路、站点与里程。
 *
 * stations 每一项：
 *   { id }                         → 引用 data/sites.js 中的点位（可点进详情）
 *   { name, lat, lng, kind, note }  → 顺路景点（不在 92 个廉洁点位内，仅作途经站）
 *
 * 说明：里程由前端按站点坐标本地计算（Haversine），不依赖任何地图服务。
 */
const ROUTES = [
  {
    id: 'yibin',
    name: '宜宾 · 红色家风研学线',
    city: '宜宾市',
    days: '1 - 2 天',
    desc: '红色印记 · 古镇清风 · 竹韵廉心 · 家风传承',
    intro: '从赵一曼纪念馆出发，沿长江东行串起李庄古镇与巴蜀家风馆，再南下蜀南竹海。一条线走完"家"与"国"的对话。',
    stations: [
      { id: 'yibin-zhaoyiman-ji' },
      { name: '李庄古镇', lat: 28.8110, lng: 104.7960, kind: '顺路景点', note: '抗战时期文化名镇，同济大学西迁旧址' },
      { id: 'yibin-bashu-jiafeng' },
      { name: '蜀南竹海', lat: 28.4660, lng: 105.0400, kind: '顺路景点', note: '万顷竹海，取"虚心有节、清正自守"之意' }
    ]
  },
  {
    id: 'nanchong',
    name: '南充 · 将帅故里廉洁线',
    city: '南充市',
    days: '2 天',
    desc: '朱德故里 · 阆中政德 · 张澜故居 · 罗瑞卿故居',
    intro: '一条线走完川东北的将帅故里与家风院落，从"总司令"到"表老"，看老一辈如何治身、治家、治事。',
    stations: [
      { id: 'nanchong-zhude-guli' },
      { id: 'nanchong-langzhong-zhengde' },
      { id: 'nanchong-zhanglan-guju' },
      { id: 'nanchong-luoruiqing-guju' }
    ]
  },
  {
    id: 'chengdu',
    name: '成都 · 天府家风廉洁线',
    city: '成都市',
    days: '1 - 2 天',
    desc: '武侯祠 · 升庵桂湖 · 天府家风馆 · 战旗村',
    intro: '从武侯祠的"静以修身、俭以养德"，到新都杨升庵的家训，再到天府家风馆与战旗村，串起成都平原的家风脉络。',
    stations: [
      { id: 'chengdu-wuhouci' },
      { id: 'chengdu-shenguan' },
      { id: 'chengdu-tianfu-jiafeng-guan' },
      { id: 'chengdu-zhanqi-cun' }
    ]
  }
];

/** 把一条路线的站点解析为 {name, lat, lng, id, kind, note} 列表 */
function resolveStations(route, sites) {
  if (!route || !route.stations) return [];
  const byId = {};
  (sites || []).forEach(function (s) { byId[String(s.id)] = s; });
  return route.stations.map(function (st) {
    if (st.id && byId[String(st.id)]) {
      const s = byId[String(st.id)];
      return {
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        kind: s.district || s.city || '廉洁点位',
        note: (s.categories || []).join(' · ')
      };
    }
    return {
      id: st.id || '',
      name: st.name,
      lat: st.lat,
      lng: st.lng,
      kind: st.kind || '顺路景点',
      note: st.note || ''
    };
  });
}

module.exports = { ROUTES: ROUTES, resolveStations: resolveStations };
