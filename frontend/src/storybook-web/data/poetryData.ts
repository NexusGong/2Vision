// ============================================
// 古诗词/古文数据库
// 支持多版本、多类型、多学段的灵活扩展
// ============================================

export interface Poetry {
  id: string;
  title: string;
  author: string;
  dynasty?: string;
  content: string[];
  fullText: string;
  tags?: string[]; // 标签：送别、思乡、边塞等
}

export interface Category {
  id: string;
  name: string;
  items: Poetry[];
}

export interface Grade {
  id: string;
  name: string;
  categories: Category[]; // 上册、下册 或其他分类
}

export interface Stage {
  id: string;
  name: string;
  grades: Grade[];
}

export interface ContentType {
  id: string;
  name: string;
  icon: string;
  stages: Stage[];
}

export interface Edition {
  id: string;
  name: string;
  description?: string;
  isCustom?: boolean;
  types: ContentType[];
}

// 诗词库数据结构
export interface PoetryStore {
  editions: Edition[];
}

// ============================================
// 苏教版小学古诗词数据
// ============================================
const sujiaoPoetryData: Poetry[] = [
  // 一年级上册
  { id: "sj-1-1-1", title: "咏鹅", author: "骆宾王", dynasty: "唐", content: ["鹅，鹅，鹅，曲项向天歌。", "白毛浮绿水，红掌拨清波。"], fullText: "咏鹅\n唐·骆宾王\n鹅，鹅，鹅，曲项向天歌。\n白毛浮绿水，红掌拨清波。", tags: ["咏物"] },
  { id: "sj-1-1-2", title: "江南", author: "汉乐府", content: ["江南可采莲，莲叶何田田。", "鱼戏莲叶间。鱼戏莲叶东，", "鱼戏莲叶西，鱼戏莲叶南，", "鱼戏莲叶北。"], fullText: "江南\n汉乐府\n江南可采莲，莲叶何田田。\n鱼戏莲叶间。鱼戏莲叶东，\n鱼戏莲叶西，鱼戏莲叶南，\n鱼戏莲叶北。", tags: ["写景"] },
  { id: "sj-1-1-3", title: "画", author: "佚名", content: ["远看山有色，近听水无声。", "春去花还在，人来鸟不惊。"], fullText: "画\n远看山有色，近听水无声。\n春去花还在，人来鸟不惊。", tags: ["写景"] },
  { id: "sj-1-1-4", title: "悯农（其二）", author: "李绅", dynasty: "唐", content: ["锄禾日当午，汗滴禾下土。", "谁知盘中餐，粒粒皆辛苦。"], fullText: "悯农（其二）\n唐·李绅\n锄禾日当午，汗滴禾下土。\n谁知盘中餐，粒粒皆辛苦。", tags: ["哲理"] },
  { id: "sj-1-1-5", title: "古朗月行（节选）", author: "李白", dynasty: "唐", content: ["小时不识月，呼作白玉盘。", "又疑瑶台镜，飞在青云端。"], fullText: "古朗月行（节选）\n唐·李白\n小时不识月，呼作白玉盘。\n又疑瑶台镜，飞在青云端。", tags: ["咏月"] },
  { id: "sj-1-1-6", title: "风", author: "李峤", dynasty: "唐", content: ["解落三秋叶，能开二月花。", "过江千尺浪，入竹万竿斜。"], fullText: "风\n唐·李峤\n解落三秋叶，能开二月花。\n过江千尺浪，入竹万竿斜。", tags: ["咏物"] },
  // 一年级下册
  { id: "sj-1-2-1", title: "春晓", author: "孟浩然", dynasty: "唐", content: ["春眠不觉晓，处处闻啼鸟。", "夜来风雨声，花落知多少。"], fullText: "春晓\n唐·孟浩然\n春眠不觉晓，处处闻啼鸟。\n夜来风雨声，花落知多少。", tags: ["写景", "春天"] },
  { id: "sj-1-2-2", title: "赠汪伦", author: "李白", dynasty: "唐", content: ["李白乘舟将欲行，忽闻岸上踏歌声。", "桃花潭水深千尺，不及汪伦送我情。"], fullText: "赠汪伦\n唐·李白\n李白乘舟将欲行，忽闻岸上踏歌声。\n桃花潭水深千尺，不及汪伦送我情。", tags: ["送别", "友情"] },
  { id: "sj-1-2-3", title: "静夜思", author: "李白", dynasty: "唐", content: ["床前明月光，疑是地上霜。", "举头望明月，低头思故乡。"], fullText: "静夜思\n唐·李白\n床前明月光，疑是地上霜。\n举头望明月，低头思故乡。", tags: ["思乡", "咏月"] },
  { id: "sj-1-2-4", title: "寻隐者不遇", author: "贾岛", dynasty: "唐", content: ["松下问童子，言师采药去。", "只在此山中，云深不知处。"], fullText: "寻隐者不遇\n唐·贾岛\n松下问童子，言师采药去。\n只在此山中，云深不知处。", tags: ["隐逸"] },
  { id: "sj-1-2-5", title: "池上", author: "白居易", dynasty: "唐", content: ["小娃撑小艇，偷采白莲回。", "不解藏踪迹，浮萍一道开。"], fullText: "池上\n唐·白居易\n小娃撑小艇，偷采白莲回。\n不解藏踪迹，浮萍一道开。", tags: ["童趣"] },
  { id: "sj-1-2-6", title: "小池", author: "杨万里", dynasty: "宋", content: ["泉眼无声惜细流，树阴照水爱晴柔。", "小荷才露尖尖角，早有蜻蜓立上头。"], fullText: "小池\n宋·杨万里\n泉眼无声惜细流，树阴照水爱晴柔。\n小荷才露尖尖角，早有蜻蜓立上头。", tags: ["写景", "夏天"] },
  { id: "sj-1-2-7", title: "画鸡", author: "唐寅", dynasty: "明", content: ["头上红冠不用裁，满身雪白走将来。", "平生不敢轻言语，一叫千门万户开。"], fullText: "画鸡\n明·唐寅\n头上红冠不用裁，满身雪白走将来。\n平生不敢轻言语，一叫千门万户开。", tags: ["咏物"] },
  // 二年级上册
  { id: "sj-2-1-1", title: "梅花", author: "王安石", dynasty: "宋", content: ["墙角数枝梅，凌寒独自开。", "遥知不是雪，为有暗香来。"], fullText: "梅花\n宋·王安石\n墙角数枝梅，凌寒独自开。\n遥知不是雪，为有暗香来。", tags: ["咏物", "冬天"] },
  { id: "sj-2-1-2", title: "小儿垂钓", author: "胡令能", dynasty: "唐", content: ["蓬头稚子学垂纶，侧坐莓苔草映身。", "路人借问遥招手，怕得鱼惊不应人。"], fullText: "小儿垂钓\n唐·胡令能\n蓬头稚子学垂纶，侧坐莓苔草映身。\n路人借问遥招手，怕得鱼惊不应人。", tags: ["童趣"] },
  { id: "sj-2-1-3", title: "登鹳雀楼", author: "王之涣", dynasty: "唐", content: ["白日依山尽，黄河入海流。", "欲穷千里目，更上一层楼。"], fullText: "登鹳雀楼\n唐·王之涣\n白日依山尽，黄河入海流。\n欲穷千里目，更上一层楼。", tags: ["写景", "哲理"] },
  { id: "sj-2-1-4", title: "望庐山瀑布", author: "李白", dynasty: "唐", content: ["日照香炉生紫烟，遥看瀑布挂前川。", "飞流直下三千尺，疑是银河落九天。"], fullText: "望庐山瀑布\n唐·李白\n日照香炉生紫烟，遥看瀑布挂前川。\n飞流直下三千尺，疑是银河落九天。", tags: ["写景", "山水"] },
  { id: "sj-2-1-5", title: "江雪", author: "柳宗元", dynasty: "唐", content: ["千山鸟飞绝，万径人踪灭。", "孤舟蓑笠翁，独钓寒江雪。"], fullText: "江雪\n唐·柳宗元\n千山鸟飞绝，万径人踪灭。\n孤舟蓑笠翁，独钓寒江雪。", tags: ["写景", "冬天"] },
  { id: "sj-2-1-6", title: "夜宿山寺", author: "李白", dynasty: "唐", content: ["危楼高百尺，手可摘星辰。", "不敢高声语，恐惊天上人。"], fullText: "夜宿山寺\n唐·李白\n危楼高百尺，手可摘星辰。\n不敢高声语，恐惊天上人。", tags: ["写景"] },
  { id: "sj-2-1-7", title: "敕勒歌", author: "北朝民歌", content: ["敕勒川，阴山下，", "天似穹庐，笼盖四野。", "天苍苍，野茫茫，风吹草低见牛羊。"], fullText: "敕勒歌\n北朝民歌\n敕勒川，阴山下，\n天似穹庐，笼盖四野。\n天苍苍，野茫茫，风吹草低见牛羊。", tags: ["写景", "边塞"] },
  // 二年级下册
  { id: "sj-2-2-1", title: "村居", author: "高鼎", dynasty: "清", content: ["草长莺飞二月天，拂堤杨柳醉春烟。", "儿童散学归来早，忙趁东风放纸鸢。"], fullText: "村居\n清·高鼎\n草长莺飞二月天，拂堤杨柳醉春烟。\n儿童散学归来早，忙趁东风放纸鸢。", tags: ["童趣", "春天"] },
  { id: "sj-2-2-2", title: "咏柳", author: "贺知章", dynasty: "唐", content: ["碧玉妆成一树高，万条垂下绿丝绦。", "不知细叶谁裁出，二月春风似剪刀。"], fullText: "咏柳\n唐·贺知章\n碧玉妆成一树高，万条垂下绿丝绦。\n不知细叶谁裁出，二月春风似剪刀。", tags: ["咏物", "春天"] },
  { id: "sj-2-2-3", title: "赋得古原草送别（节选）", author: "白居易", dynasty: "唐", content: ["离离原上草，一岁一枯荣。", "野火烧不尽，春风吹又生。"], fullText: "赋得古原草送别（节选）\n唐·白居易\n离离原上草，一岁一枯荣。\n野火烧不尽，春风吹又生。", tags: ["送别", "哲理"] },
  { id: "sj-2-2-4", title: "晓出净慈寺送林子方", author: "杨万里", dynasty: "宋", content: ["毕竟西湖六月中，风光不与四时同。", "接天莲叶无穷碧，映日荷花别样红。"], fullText: "晓出净慈寺送林子方\n宋·杨万里\n毕竟西湖六月中，风光不与四时同。\n接天莲叶无穷碧，映日荷花别样红。", tags: ["写景", "夏天"] },
  { id: "sj-2-2-5", title: "绝句", author: "杜甫", dynasty: "唐", content: ["两个黄鹂鸣翠柳，一行白鹭上青天。", "窗含西岭千秋雪，门泊东吴万里船。"], fullText: "绝句\n唐·杜甫\n两个黄鹂鸣翠柳，一行白鹭上青天。\n窗含西岭千秋雪，门泊东吴万里船。", tags: ["写景"] },
  { id: "sj-2-2-6", title: "悯农（其一）", author: "李绅", dynasty: "唐", content: ["春种一粒粟，秋收万颗子。", "四海无闲田，农夫犹饿死。"], fullText: "悯农（其一）\n唐·李绅\n春种一粒粟，秋收万颗子。\n四海无闲田，农夫犹饿死。", tags: ["哲理"] },
  { id: "sj-2-2-7", title: "舟夜书所见", author: "查慎行", dynasty: "清", content: ["月黑见渔灯，孤光一点萤。", "微微风簇浪，散作满河星。"], fullText: "舟夜书所见\n清·查慎行\n月黑见渔灯，孤光一点萤。\n微微风簇浪，散作满河星。", tags: ["写景"] },
  // 三年级上册
  { id: "sj-3-1-1", title: "所见", author: "袁枚", dynasty: "清", content: ["牧童骑黄牛，歌声振林樾。", "意欲捕鸣蝉，忽然闭口立。"], fullText: "所见\n清·袁枚\n牧童骑黄牛，歌声振林樾。\n意欲捕鸣蝉，忽然闭口立。", tags: ["童趣"] },
  { id: "sj-3-1-2", title: "山行", author: "杜牧", dynasty: "唐", content: ["远上寒山石径斜，白云生处有人家。", "停车坐爱枫林晚，霜叶红于二月花。"], fullText: "山行\n唐·杜牧\n远上寒山石径斜，白云生处有人家。\n停车坐爱枫林晚，霜叶红于二月花。", tags: ["写景", "秋天"] },
  { id: "sj-3-1-3", title: "赠刘景文", author: "苏轼", dynasty: "宋", content: ["荷尽已无擎雨盖，菊残犹有傲霜枝。", "一年好景君须记，最是橙黄橘绿时。"], fullText: "赠刘景文\n宋·苏轼\n荷尽已无擎雨盖，菊残犹有傲霜枝。\n一年好景君须记，最是橙黄橘绿时。", tags: ["秋天", "哲理"] },
  { id: "sj-3-1-4", title: "夜书所见", author: "叶绍翁", dynasty: "宋", content: ["萧萧梧叶送寒声，江上秋风动客情。", "知有儿童挑促织，夜深篱落一灯明。"], fullText: "夜书所见\n宋·叶绍翁\n萧萧梧叶送寒声，江上秋风动客情。\n知有儿童挑促织，夜深篱落一灯明。", tags: ["思乡", "秋天"] },
  { id: "sj-3-1-5", title: "望天门山", author: "李白", dynasty: "唐", content: ["天门中断楚江开，碧水东流至此回。", "两岸青山相对出，孤帆一片日边来。"], fullText: "望天门山\n唐·李白\n天门中断楚江开，碧水东流至此回。\n两岸青山相对出，孤帆一片日边来。", tags: ["写景", "山水"] },
  { id: "sj-3-1-6", title: "饮湖上初晴后雨", author: "苏轼", dynasty: "宋", content: ["水光潋滟晴方好，山色空蒙雨亦奇。", "欲把西湖比西子，淡妆浓抹总相宜。"], fullText: "饮湖上初晴后雨\n宋·苏轼\n水光潋滟晴方好，山色空蒙雨亦奇。\n欲把西湖比西子，淡妆浓抹总相宜。", tags: ["写景", "山水"] },
  // 三年级下册
  { id: "sj-3-2-1", title: "望洞庭", author: "刘禹锡", dynasty: "唐", content: ["湖光秋月两相和，潭面无风镜未磨。", "遥望洞庭山水翠，白银盘里一青螺。"], fullText: "望洞庭\n唐·刘禹锡\n湖光秋月两相和，潭面无风镜未磨。\n遥望洞庭山水翠，白银盘里一青螺。", tags: ["写景", "山水"] },
  { id: "sj-3-2-2", title: "早发白帝城", author: "李白", dynasty: "唐", content: ["朝辞白帝彩云间，千里江陵一日还。", "两岸猿声啼不住，轻舟已过万重山。"], fullText: "早发白帝城\n唐·李白\n朝辞白帝彩云间，千里江陵一日还。\n两岸猿声啼不住，轻舟已过万重山。", tags: ["写景", "山水"] },
  { id: "sj-3-2-3", title: "绝句", author: "杜甫", dynasty: "唐", content: ["迟日江山丽，春风花草香。", "泥融飞燕子，沙暖睡鸳鸯。"], fullText: "绝句\n唐·杜甫\n迟日江山丽，春风花草香。\n泥融飞燕子，沙暖睡鸳鸯。", tags: ["写景", "春天"] },
  { id: "sj-3-2-4", title: "惠崇春江晚景", author: "苏轼", dynasty: "宋", content: ["竹外桃花三两枝，春江水暖鸭先知。", "萎蒿满地芦芽短，正是河豚欲上时。"], fullText: "惠崇春江晚景\n宋·苏轼\n竹外桃花三两枝，春江水暖鸭先知。\n萎蒿满地芦芽短，正是河豚欲上时。", tags: ["写景", "春天"] },
  { id: "sj-3-2-5", title: "忆江南", author: "白居易", dynasty: "唐", content: ["江南好，风景旧曾谙。", "日出江花红胜火，春来江水绿如蓝。", "能不忆江南？"], fullText: "忆江南\n唐·白居易\n江南好，风景旧曾谙。\n日出江花红胜火，春来江水绿如蓝。\n能不忆江南？", tags: ["写景", "思乡"] },
  { id: "sj-3-2-6", title: "元日", author: "王安石", dynasty: "宋", content: ["爆竹声中一岁除，春风送暖入屠苏。", "千门万户瞳瞳日，总把新桃换旧符。"], fullText: "元日\n宋·王安石\n爆竹声中一岁除，春风送暖入屠苏。\n千门万户瞳瞳日，总把新桃换旧符。", tags: ["节日"] },
  { id: "sj-3-2-7", title: "清明", author: "杜牧", dynasty: "唐", content: ["清明时节雨纷纷，路上行人欲断魂。", "借问酒家何处有？牧童遥指杏花村。"], fullText: "清明\n唐·杜牧\n清明时节雨纷纷，路上行人欲断魂。\n借问酒家何处有？牧童遥指杏花村。", tags: ["节日"] },
  { id: "sj-3-2-8", title: "九月九日忆山东兄弟", author: "王维", dynasty: "唐", content: ["独在异乡为异客，每逢佳节倍思亲。", "遥知兄弟登高处，遍插茱萸少一人。"], fullText: "九月九日忆山东兄弟\n唐·王维\n独在异乡为异客，每逢佳节倍思亲。\n遥知兄弟登高处，遍插茱萸少一人。", tags: ["思乡", "节日"] },
  // 四年级上册
  { id: "sj-4-1-1", title: "鹿柴", author: "王维", dynasty: "唐", content: ["空山不见人，但闻人语响。", "返景入深林，复照青苔上。"], fullText: "鹿柴\n唐·王维\n空山不见人，但闻人语响。\n返景入深林，复照青苔上。", tags: ["写景", "山水"] },
  { id: "sj-4-1-2", title: "暮江吟", author: "白居易", dynasty: "唐", content: ["一道残阳铺水中，半江瑟瑟半江红。", "可怜九月初三夜，露似真珠月似弓。"], fullText: "暮江吟\n唐·白居易\n一道残阳铺水中，半江瑟瑟半江红。\n可怜九月初三夜，露似真珠月似弓。", tags: ["写景"] },
  { id: "sj-4-1-3", title: "题西林壁", author: "苏轼", dynasty: "宋", content: ["横看成岭侧成峰，远近高低各不同。", "不识庐山真面目，只缘身在此山中。"], fullText: "题西林壁\n宋·苏轼\n横看成岭侧成峰，远近高低各不同。\n不识庐山真面目，只缘身在此山中。", tags: ["哲理", "山水"] },
  { id: "sj-4-1-4", title: "雪梅", author: "卢梅坡", dynasty: "宋", content: ["梅雪争春未肯降，骚人阁笔费评章。", "梅须逊雪三分白，雪却输梅一段香。"], fullText: "雪梅\n宋·卢梅坡\n梅雪争春未肯降，骚人阁笔费评章。\n梅须逊雪三分白，雪却输梅一段香。", tags: ["咏物", "冬天"] },
  { id: "sj-4-1-5", title: "出塞", author: "王昌龄", dynasty: "唐", content: ["秦时明月汉时关，万里长征人未还。", "但使龙城飞将在，不教胡马度阴山。"], fullText: "出塞\n唐·王昌龄\n秦时明月汉时关，万里长征人未还。\n但使龙城飞将在，不教胡马度阴山。", tags: ["边塞", "爱国"] },
  { id: "sj-4-1-6", title: "凉州词", author: "王翰", dynasty: "唐", content: ["葡萄美酒夜光杯，欲饮琵琶马上催。", "醉卧沙场君莫笑，古来征战几人回？"], fullText: "凉州词\n唐·王翰\n葡萄美酒夜光杯，欲饮琵琶马上催。\n醉卧沙场君莫笑，古来征战几人回？", tags: ["边塞"] },
  // 四年级下册
  { id: "sj-4-2-1", title: "四时田园杂兴（其二十五）", author: "范成大", dynasty: "宋", content: ["梅子金黄杏子肥，麦花雪白菜花稀。", "日长篱落无人过，惟有蜻蜓蛱蝶飞。"], fullText: "四时田园杂兴（其二十五）\n宋·范成大\n梅子金黄杏子肥，麦花雪白菜花稀。\n日长篱落无人过，惟有蜻蜓蛱蝶飞。", tags: ["田园", "夏天"] },
  { id: "sj-4-2-2", title: "宿新市徐公店", author: "杨万里", dynasty: "宋", content: ["篱落疏疏一径深，树头新绿未成阴。", "儿童急走追黄蝶，飞入菜花无处寻。"], fullText: "宿新市徐公店\n宋·杨万里\n篱落疏疏一径深，树头新绿未成阴。\n儿童急走追黄蝶，飞入菜花无处寻。", tags: ["童趣", "春天"] },
  { id: "sj-4-2-3", title: "清平乐·村居", author: "辛弃疾", dynasty: "宋", content: ["茅檐低小，溪上青青草。", "醉里吴音相媚好，白发谁家翁媪？", "大儿锄豆溪东，中儿正织鸡笼。", "最喜小儿亡赖，溪头卧剥莲蓬。"], fullText: "清平乐·村居\n宋·辛弃疾\n茅檐低小，溪上青青草。\n醉里吴音相媚好，白发谁家翁媪？\n大儿锄豆溪东，中儿正织鸡笼。\n最喜小儿亡赖，溪头卧剥莲蓬。", tags: ["田园"] },
  { id: "sj-4-2-4", title: "墨梅", author: "王冕", dynasty: "元", content: ["我家洗砚池头树，朵朵花开淡墨痕。", "不要人夸好颜色，只留清气满乾坤。"], fullText: "墨梅\n元·王冕\n我家洗砚池头树，朵朵花开淡墨痕。\n不要人夸好颜色，只留清气满乾坤。", tags: ["咏物", "品格"] },
  // 五年级上册
  { id: "sj-5-1-1", title: "示儿", author: "陆游", dynasty: "宋", content: ["死去元知万事空，但悲不见九州同。", "王师北定中原日，家祭无忘告乃翁。"], fullText: "示儿\n宋·陆游\n死去元知万事空，但悲不见九州同。\n王师北定中原日，家祭无忘告乃翁。", tags: ["爱国"] },
  { id: "sj-5-1-2", title: "题临安邸", author: "林升", dynasty: "宋", content: ["山外青山楼外楼，西湖歌舞几时休？", "暖风熏得游人醉，直把杭州作汴州。"], fullText: "题临安邸\n宋·林升\n山外青山楼外楼，西湖歌舞几时休？\n暖风熏得游人醉，直把杭州作汴州。", tags: ["爱国"] },
  { id: "sj-5-1-3", title: "己亥杂诗", author: "龚自珍", dynasty: "清", content: ["九州生气恃风雷，万马齐喑究可哀。", "我劝天公重抖擞，不拘一格降人材。"], fullText: "己亥杂诗\n清·龚自珍\n九州生气恃风雷，万马齐喑究可哀。\n我劝天公重抖擞，不拘一格降人材。", tags: ["爱国"] },
  { id: "sj-5-1-4", title: "山居秋暝", author: "王维", dynasty: "唐", content: ["空山新雨后，天气晚来秋。", "明月松间照，清泉石上流。", "竹喧归浣女，莲动下渔舟。", "随意春芳歇，王孙自可留。"], fullText: "山居秋暝\n唐·王维\n空山新雨后，天气晚来秋。\n明月松间照，清泉石上流。\n竹喧归浣女，莲动下渔舟。\n随意春芳歇，王孙自可留。", tags: ["写景", "山水", "秋天"] },
  { id: "sj-5-1-5", title: "枫桥夜泊", author: "张继", dynasty: "唐", content: ["月落乌啼霜满天，江枫渔火对愁眠。", "姑苏城外寒山寺，夜半钟声到客船。"], fullText: "枫桥夜泊\n唐·张继\n月落乌啼霜满天，江枫渔火对愁眠。\n姑苏城外寒山寺，夜半钟声到客船。", tags: ["思乡", "秋天"] },
  { id: "sj-5-1-6", title: "长相思", author: "纳兰性德", dynasty: "清", content: ["山一程，水一程，", "身向榆关那畔行，夜深千帐灯。", "风一更，雪一更，", "聒碎乡心梦不成，故园无此声。"], fullText: "长相思\n清·纳兰性德\n山一程，水一程，\n身向榆关那畔行，夜深千帐灯。\n风一更，雪一更，\n聒碎乡心梦不成，故园无此声。", tags: ["思乡"] },
  // 五年级下册
  { id: "sj-5-2-1", title: "四时田园杂兴·其三十一", author: "范成大", dynasty: "宋", content: ["昼出耘田夜绩麻，村庄儿女各当家。", "童孙未解供耕织，也傍桑阴学种瓜。"], fullText: "四时田园杂兴·其三十一\n宋·范成大\n昼出耘田夜绩麻，村庄儿女各当家。\n童孙未解供耕织，也傍桑阴学种瓜。", tags: ["田园", "童趣"] },
  { id: "sj-5-2-2", title: "游子吟", author: "孟郊", dynasty: "唐", content: ["慈母手中线，游子身上衣。", "临行密密缝，意恐迟迟归。", "谁言寸草心，报得三春晖。"], fullText: "游子吟\n唐·孟郊\n慈母手中线，游子身上衣。\n临行密密缝，意恐迟迟归。\n谁言寸草心，报得三春晖。", tags: ["亲情"] },
  { id: "sj-5-2-3", title: "从军行", author: "王昌龄", dynasty: "唐", content: ["青海长云暗雪山，孤城遥望玉门关。", "黄沙百战穿金甲，不破楼兰终不还。"], fullText: "从军行\n唐·王昌龄\n青海长云暗雪山，孤城遥望玉门关。\n黄沙百战穿金甲，不破楼兰终不还。", tags: ["边塞", "爱国"] },
  { id: "sj-5-2-4", title: "秋夜将晓出篱门迎凉有感", author: "陆游", dynasty: "宋", content: ["三万里河东入海，五千仞岳上摩天。", "遗民泪尽胡尘里，南望王师又一年。"], fullText: "秋夜将晓出篱门迎凉有感\n宋·陆游\n三万里河东入海，五千仞岳上摩天。\n遗民泪尽胡尘里，南望王师又一年。", tags: ["爱国"] },
  // 六年级上册
  { id: "sj-6-1-1", title: "宿建德江", author: "孟浩然", dynasty: "唐", content: ["移舟泊烟渚，日暮客愁新。", "野旷天低树，江清月近人。"], fullText: "宿建德江\n唐·孟浩然\n移舟泊烟渚，日暮客愁新。\n野旷天低树，江清月近人。", tags: ["写景", "思乡"] },
  { id: "sj-6-1-2", title: "六月二十七日望湖楼醉书", author: "苏轼", dynasty: "宋", content: ["黑云翻墨未遮山，白雨跳珠乱入船。", "卷地风来忽吹散，望湖楼下水如天。"], fullText: "六月二十七日望湖楼醉书\n宋·苏轼\n黑云翻墨未遮山，白雨跳珠乱入船。\n卷地风来忽吹散，望湖楼下水如天。", tags: ["写景"] },
  { id: "sj-6-1-3", title: "西江月·夜行黄沙道中", author: "辛弃疾", dynasty: "宋", content: ["明月别枝惊鹊，清风半夜鸣蝉。", "稻花香里说丰年，听取蛙声一片。", "七八个星天外，两三点雨山前。", "旧时茅店社林边，路转溪桥忽见。"], fullText: "西江月·夜行黄沙道中\n宋·辛弃疾\n明月别枝惊鹊，清风半夜鸣蝉。\n稻花香里说丰年，听取蛙声一片。\n七八个星天外，两三点雨山前。\n旧时茅店社林边，路转溪桥忽见。", tags: ["写景", "田园"] },
  { id: "sj-6-1-4", title: "七律·长征", author: "毛泽东", content: ["红军不怕远征难，万水千山只等闲。", "五岭逶迤腾细浪，乌蒙磅礴走泥丸。", "金沙水拍云崖暖，大渡桥横铁索寒。", "更喜岷山千里雪，三军过后尽开颜。"], fullText: "七律·长征\n毛泽东\n红军不怕远征难，万水千山只等闲。\n五岭逶迤腾细浪，乌蒙磅礴走泥丸。\n金沙水拍云崖暖，大渡桥横铁索寒。\n更喜岷山千里雪，三军过后尽开颜。", tags: ["爱国"] },
  // 六年级下册
  { id: "sj-6-2-1", title: "寒食", author: "韩翃", dynasty: "唐", content: ["春城无处不飞花，寒食东风御柳斜。", "日暮汉宫传蜡烛，轻烟散入五侯家。"], fullText: "寒食\n唐·韩翃\n春城无处不飞花，寒食东风御柳斜。\n日暮汉宫传蜡烛，轻烟散入五侯家。", tags: ["节日"] },
  { id: "sj-6-2-2", title: "十五夜望月", author: "王建", dynasty: "唐", content: ["中庭地白树栖鸦，冷露无声湿桂花。", "今夜月明人尽望，不知秋思落谁家。"], fullText: "十五夜望月\n唐·王建\n中庭地白树栖鸦，冷露无声湿桂花。\n今夜月明人尽望，不知秋思落谁家。", tags: ["思乡", "咏月"] },
  { id: "sj-6-2-3", title: "马诗", author: "李贺", dynasty: "唐", content: ["大漠沙如雪，燕山月似钩。", "何当金络脑，快走踏清秋。"], fullText: "马诗\n唐·李贺\n大漠沙如雪，燕山月似钩。\n何当金络脑，快走踏清秋。", tags: ["咏物", "边塞"] },
  { id: "sj-6-2-4", title: "石灰吟", author: "于谦", dynasty: "明", content: ["千锤万凿出深山，烈火焚烧若等闲。", "粉骨碎身浑不怕，要留清白在人间。"], fullText: "石灰吟\n明·于谦\n千锤万凿出深山，烈火焚烧若等闲。\n粉骨碎身浑不怕，要留清白在人间。", tags: ["咏物", "品格"] },
  { id: "sj-6-2-5", title: "竹石", author: "郑燮", dynasty: "清", content: ["咬定青山不放松，立根原在破岩中。", "千磨万击还坚劲，任尔东西南北风。"], fullText: "竹石\n清·郑燮\n咬定青山不放松，立根原在破岩中。\n千磨万击还坚劲，任尔东西南北风。", tags: ["咏物", "品格"] },
];

// 构建苏教版数据结构
const buildSujiaoEdition = (): Edition => {
  const gradeMap: { [key: string]: { 上册: Poetry[], 下册: Poetry[] } } = {
    "一年级": { 上册: [], 下册: [] },
    "二年级": { 上册: [], 下册: [] },
    "三年级": { 上册: [], 下册: [] },
    "四年级": { 上册: [], 下册: [] },
    "五年级": { 上册: [], 下册: [] },
    "六年级": { 上册: [], 下册: [] },
  };

  // 根据ID分类
  sujiaoPoetryData.forEach(poetry => {
    const parts = poetry.id.split('-');
    const gradeNum = parseInt(parts[1]);
    const semester = parts[2] === '1' ? '上册' : '下册';
    const gradeNames = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"];
    const gradeName = gradeNames[gradeNum - 1];
    if (gradeMap[gradeName]) {
      gradeMap[gradeName][semester].push(poetry);
    }
  });

  const grades: Grade[] = Object.entries(gradeMap).map(([name, semesters]) => ({
    id: `grade-${name}`,
    name,
    categories: [
      { id: `${name}-上册`, name: "上册", items: semesters.上册 },
      { id: `${name}-下册`, name: "下册", items: semesters.下册 },
    ],
  }));

  return {
    id: "sujiao",
    name: "苏教版",
    description: "江苏教育出版社",
    types: [
      {
        id: "poetry",
        name: "古诗词",
        icon: "📜",
        stages: [
          {
            id: "primary",
            name: "小学",
            grades,
          },
        ],
      },
    ],
  };
};

// 初始化诗词库
const poetryStore: PoetryStore = {
  editions: [buildSujiaoEdition()],
};

// ============================================
// 自定义诗词管理
// ============================================
const CUSTOM_STORAGE_KEY = "custom_poetry_store";

export interface CustomPoetry extends Poetry {
  createdAt: number;
}

// 获取自定义诗词
export function getCustomPoetryList(): CustomPoetry[] {
  try {
    const data = localStorage.getItem(CUSTOM_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 保存自定义诗词
export function saveCustomPoetry(poetry: Omit<CustomPoetry, "id" | "createdAt">): CustomPoetry {
  const list = getCustomPoetryList();
  const newPoetry: CustomPoetry = {
    ...poetry,
    id: `custom-${Date.now()}`,
    createdAt: Date.now(),
  };
  list.unshift(newPoetry);
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(list));
  return newPoetry;
}

// 删除自定义诗词
export function deleteCustomPoetry(id: string): boolean {
  const list = getCustomPoetryList();
  const newList = list.filter(p => p.id !== id);
  if (newList.length !== list.length) {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(newList));
    return true;
  }
  return false;
}

// ============================================
// 导出函数
// ============================================

// 获取所有版本
export function getEditions(): Edition[] {
  return poetryStore.editions;
}

// 获取指定版本
export function getEdition(editionId: string): Edition | undefined {
  return poetryStore.editions.find(e => e.id === editionId);
}

// 搜索诗词
export function searchPoetry(keyword: string): Poetry[] {
  const results: Poetry[] = [];
  const lowerKeyword = keyword.toLowerCase();

  // 搜索所有版本
  poetryStore.editions.forEach(edition => {
    edition.types.forEach(type => {
      type.stages.forEach(stage => {
        stage.grades.forEach(grade => {
          grade.categories.forEach(category => {
            category.items.forEach(poetry => {
              if (
                poetry.title.toLowerCase().includes(lowerKeyword) ||
                poetry.author.toLowerCase().includes(lowerKeyword) ||
                poetry.content.some(line => line.includes(keyword))
              ) {
                results.push(poetry);
              }
            });
          });
        });
      });
    });
  });

  // 搜索自定义诗词
  const customList = getCustomPoetryList();
  customList.forEach(poetry => {
    if (
      poetry.title.toLowerCase().includes(lowerKeyword) ||
      poetry.author.toLowerCase().includes(lowerKeyword) ||
      poetry.content.some(line => line.includes(keyword))
    ) {
      results.push(poetry);
    }
  });

  return results;
}

// 获取所有诗词（用于统计等）
export function getAllPoetry(): Poetry[] {
  const results: Poetry[] = [];

  poetryStore.editions.forEach(edition => {
    edition.types.forEach(type => {
      type.stages.forEach(stage => {
        stage.grades.forEach(grade => {
          grade.categories.forEach(category => {
            results.push(...category.items);
          });
        });
      });
    });
  });

  return results;
}

// 兼容旧接口
export const gradeList = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"];

export interface GradePoetry {
  上册: Poetry[];
  下册: Poetry[];
}

export function getGradePoetry(grade: string): GradePoetry {
  const edition = poetryStore.editions[0];
  if (!edition) return { 上册: [], 下册: [] };
  
  const type = edition.types[0];
  if (!type) return { 上册: [], 下册: [] };
  
  const stage = type.stages[0];
  if (!stage) return { 上册: [], 下册: [] };
  
  const gradeData = stage.grades.find(g => g.name === grade);
  if (!gradeData) return { 上册: [], 下册: [] };
  
  const shangce = gradeData.categories.find(c => c.name === "上册")?.items || [];
  const xiace = gradeData.categories.find(c => c.name === "下册")?.items || [];
  
  return { 上册: shangce, 下册: xiace };
}

export default poetryStore;
