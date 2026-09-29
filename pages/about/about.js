const { CATEGORIES } = require('../../data/constants.js');
const { SITES } = require('../../data/sites.js');

/** 2018 年四川省纪委监委、省委宣传部命名的省级廉洁文化基地名单（官方公布） */
const OFFICIAL_LIST = [
  { city: '成都市', names: ['成都武侯祠博物馆', '升庵桂湖暨杨氏宗祠', '“蔬乡清韵”优秀传统文化教育基地'] },
  { city: '自贡市', names: ['吴玉章故居'] },
  { city: '攀枝花市', names: ['攀枝花中国三线建设博物馆'] },
  { city: '泸州市', names: ['红军长征四渡赤水纪念地'] },
  { city: '德阳市', names: ['绵竹廉洁年画创作基地'] },
  { city: '绵阳市', names: ['中国两弹城'] },
  { city: '广元市', names: ['川北家风馆'] },
  { city: '遂宁市', names: ['蓬溪廉洁书法创作基地'] },
  { city: '内江市', names: ['隆昌石牌坊群'] },
  { city: '乐山市', names: ['郭沫若故居纪念馆'] },
  { city: '南充市', names: ['朱德故里'] },
  { city: '宜宾市', names: ['巴蜀家风传承示范基地'] },
  { city: '广安市', names: ['邓小平故里'] },
  { city: '达州市', names: ['神剑园'] },
  { city: '巴中市', names: ['川陕革命根据地红军烈士陵园'] },
  { city: '雅安市', names: ['中国工农红军强渡大渡河纪念馆'] },
  { city: '眉山市', names: ['眉山三苏祠'] },
  { city: '资阳市', names: ['陈毅故居'] },
  { city: '阿坝州', names: ['红军长征纪念碑碑园'] },
  { city: '甘孜州', names: ['红军飞夺泸定桥纪念碑公园'] },
  { city: '凉山州', names: ['彝海结盟纪念馆'] },
  { city: '省本级', names: ['四川省纪检监察陈列室'] }
];

Page({
  data: {
    categories: [],
    officialList: OFFICIAL_LIST,
    stats: {},
    usage: [
      '进入「廉图」：地图上每一个圆钉是一个廉洁文化点位，颜色对应五类廉洁要素，点开圆钉可看名称与卡片。',
      '用顶部筛选项：点分类只看"红色廉洁""家风家训"等某一类；点"全部市州"可切换到任意市州或一键回到"我的家乡"。',
      '点底部卡片或圆钉进入详情页：看点位简介、廉洁看点、循迹读史与名言家训，并可一键导航、电话预约。',
      '在详情页点"标记循迹"，把走过、讲过的点位收进「廉迹 - 我的循迹」，可用于主题党日、支部学习打卡统计。',
      '进入「廉迹」列表页：支持按场馆名、市州、廉洁要素（如 朱德 / 家风 / 长征）搜索，授权定位后自动按距离从近到远排列。'
    ],
    sources: [
      '四川省纪委监委、四川省委宣传部 2018 年命名"四川省廉洁文化基地"名单（24 个）及官方公布的场馆地址。',
      '四川省纪委监委、重庆市纪委监委"川渝好家风"廉洁文化体验环线名单（含场馆地址与预约电话）。',
      '四川省纪委监委"廉洁四川"平台、各市州纪委监委及政府门户网站公开的廉洁文化、红色教育基地信息。',
      '各场馆官方公众号、文旅部门公开的开放信息与展陈介绍。'
    ]
  },

  onLoad() {
    const citySet = {};
    let official = 0;
    SITES.forEach(function (s) {
      citySet[s.city] = true;
      if (s.official) official += 1;
    });
    this.setData({
      stats: {
        sites: SITES.length,
        cities: Object.keys(citySet).length,
        official: official,
        categories: CATEGORIES.length
      },
      categories: CATEGORIES.map(function (c) {
        return {
          key: c.key,
          color: c.color,
          desc: c.desc,
          count: SITES.filter(function (s) {
            return (s.categories || []).indexOf(c.key) > -1;
          }).length
        };
      })
    });
  },

  onShareAppMessage() {
    return { title: '清风循迹 · 四川廉洁文化地图', path: '/pages/map/map' };
  }
});
