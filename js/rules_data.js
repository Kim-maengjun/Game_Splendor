/**
 * Splendor 3D - Rules, Gems, 90 Official Cards, 10 Nobles & Modern Expansion Data
 * Exposes window.SplendorData
 */
(function (root) {
  'use strict';

  // 1. 보석 6종 정의 (5 기본 보석 + 1 황금 조커)
  const GEMS = {
    emerald: {
      id: 'emerald',
      korName: '에메랄드',
      engName: 'Emerald',
      colorHex: '#10b981',
      accentHex: '#059669',
      lightHex: '#d1fae5',
      textHex: '#ffffff',
      order: 0,
      isJoker: false,
      sprite: { col: 0, row: 0, icon: '💚', shape: 'octagon' }
    },
    sapphire: {
      id: 'sapphire',
      korName: '사파이어',
      engName: 'Sapphire',
      colorHex: '#2563eb',
      accentHex: '#1d4ed8',
      lightHex: '#dbeafe',
      textHex: '#ffffff',
      order: 1,
      isJoker: false,
      sprite: { col: 1, row: 0, icon: '💙', shape: 'oval' }
    },
    ruby: {
      id: 'ruby',
      korName: '루비',
      engName: 'Ruby',
      colorHex: '#e11d48',
      accentHex: '#be123c',
      lightHex: '#ffe4e6',
      textHex: '#ffffff',
      order: 2,
      isJoker: false,
      sprite: { col: 2, row: 0, icon: '❤️', shape: 'cushion' }
    },
    diamond: {
      id: 'diamond',
      korName: '다이아몬드',
      engName: 'Diamond',
      colorHex: '#f8fafc',
      accentHex: '#cbd5e1',
      lightHex: '#ffffff',
      textHex: '#0f172a',
      order: 3,
      isJoker: false,
      sprite: { col: 3, row: 0, icon: '🤍', shape: 'brilliant' }
    },
    onyx: {
      id: 'onyx',
      korName: '오닉스',
      engName: 'Onyx',
      colorHex: '#1e293b',
      accentHex: '#0f172a',
      lightHex: '#e2e8f0',
      textHex: '#f8fafc',
      order: 4,
      isJoker: false,
      sprite: { col: 4, row: 0, icon: '🖤', shape: 'pear' }
    },
    gold: {
      id: 'gold',
      korName: '황금(조커)',
      engName: 'Gold Joker',
      colorHex: '#f59e0b',
      accentHex: '#d97706',
      lightHex: '#fef3c7',
      textHex: '#1e293b',
      order: 5,
      isJoker: true,
      sprite: { col: 5, row: 0, icon: '🪙', shape: 'coin' }
    }
  };

  const GEM_KEYS = ['emerald', 'sapphire', 'ruby', 'diamond', 'onyx'];
  const ALL_TOKEN_KEYS = ['emerald', 'sapphire', 'ruby', 'diamond', 'onyx', 'gold'];

  // 테마 타이틀 및 일러스트 타입 생성 도우미
  const THEME_TITLES = {
    1: {
      emerald: ['비취 노천 광산', '안데스 원석 채굴장', '숲속의 원석 수레', '강변 사금 채취소', '녹주석 계곡 갱도', '신대륙 탐사선', '산악 노새 상단', '원석 세척 공방'],
      sapphire: ['실론 청옥 광산', '깊은 바다 채굴소', '하늘빛 계곡 갱도', '해안 무역 범선', '카슈미르 원석 수레', '푸른 암초 채석장', '강하구 나룻배', '청금석 분류소'],
      ruby: ['버마 홍옥 갱도', '화산지대 채굴장', '붉은 협곡 수레', '남방 향신료 무역선', '석류석 원석 광산', '사막 낙타 대상', '용암동굴 채석장', '붉은 모래 정제소'],
      diamond: ['골콘다 충적 광산', '빙하 계곡 채석장', '하얀 절벽 갱도', '북해 상선단', '수정 동굴 채굴소', '백색 규석 수레', '고원 원석 탐색대', '투명 원석 선별장'],
      onyx: ['흑요석 화산 갱도', '검은 협곡 채석장', '지하 심층 광산', '밤바다 갤리선', '흑옥 운반 마차', '칠흑의 바위 굴', '심연 채굴 캠프', '흑색 원석 창고']
    },
    2: {
      emerald: ['피렌체 세공 장인', '초록 보석 연마소', '베네치아 유리 공방', '르네상스 보석 상회', '밀라노 세공 길드', '에메랄드 세팅 공방'],
      sapphire: ['앤트워프 커팅 명인', '청옥 폴리싱 공방', '제노바 해양 거래소', '리스본 보석 무역상', '사파이어 세공 아틀리에', '왕실 청옥 중개상'],
      ruby: ['브뤼헤 홍옥 세공사', '루비 정밀 커팅실', '아우크스부르크 금융가', '동방 실크로드 상단', '진홍빛 장신구 공방', '추기경의 보석 중개인'],
      diamond: ['암스테르담 연마 장인', '브릴리언트 컷 공방', '한자 동맹 무역 거점', '파리 보석 감정소', '순백의 왕관 세공실', '유럽 대륙 특사단'],
      onyx: ['뉘른베르크 조각 명인', '오닉스 카메오 공방', '세비야 신대륙 거래소', '합스부르크 어용 상인', '흑옥 인장 세공소', '그림자 길드 교역소']
    },
    3: {
      emerald: ['그라나다 알함브라 궁전', '제국의 비취 보물고', '대성당 스테인드글라스', '왕실 에메랄드 왕관'],
      sapphire: ['베르사유 거울의 방', '대양 제국의 해군 본부', '교황청 사파이어 성배', '창공의 제국 대성당'],
      ruby: ['메디치 가문 대궁전', '황제의 대관식 보주', '산마르코 대성당 제단', '태양왕의 루비 목걸이'],
      diamond: ['합스부르크 황실 박물관', '절대왕정의 다이아몬드 홀', '바티칸 시스티나 성당', '유럽 황실 보석 교역소'],
      onyx: ['엘 에스코리알 왕궁', '제국 대법원 검은 옥좌', '비엔나 황실 오페라관', '오스만 술탄의 흑옥 궁전']
    }
  };

  const ILLUST_TYPES = {
    1: ['mine', 'cart', 'caravan', 'ship', 'quarry', 'tunnel', 'camp', 'washer'],
    2: ['artisan', 'workshop', 'guild', 'merchant', 'exchange', 'atelier'],
    3: ['palace', 'crown', 'cathedral', 'treasury']
  };

  // 표준 스플렌더 90장 개발 카드 원형 정의
  // 각 항목: [level, bonusGem, points, { emerald, sapphire, ruby, diamond, onyx }]
  const RAW_CARDS = [
    // ==================== LEVEL 1 (40 Cards: 8 per gem) ====================
    // Onyx (Black) Bonus - 8 cards
    [1, 'onyx', 0, { emerald: 1, sapphire: 1, ruby: 1, diamond: 1 }],
    [1, 'onyx', 0, { emerald: 1, sapphire: 2, ruby: 1, diamond: 1 }],
    [1, 'onyx', 0, { sapphire: 2, ruby: 1, diamond: 2 }],
    [1, 'onyx', 0, { emerald: 1, ruby: 3, onyx: 1 }],
    [1, 'onyx', 0, { emerald: 2, ruby: 1 }],
    [1, 'onyx', 0, { emerald: 2, diamond: 2 }],
    [1, 'onyx', 0, { emerald: 3 }],
    [1, 'onyx', 1, { sapphire: 4 }],

    // Sapphire (Blue) Bonus - 8 cards
    [1, 'sapphire', 0, { emerald: 1, ruby: 1, diamond: 1, onyx: 1 }],
    [1, 'sapphire', 0, { emerald: 1, ruby: 2, diamond: 1, onyx: 1 }],
    [1, 'sapphire', 0, { emerald: 2, ruby: 2, diamond: 1 }],
    [1, 'sapphire', 0, { sapphire: 1, emerald: 3, ruby: 1 }],
    [1, 'sapphire', 0, { diamond: 1, onyx: 2 }],
    [1, 'sapphire', 0, { emerald: 2, onyx: 2 }],
    [1, 'sapphire', 0, { onyx: 3 }],
    [1, 'sapphire', 1, { ruby: 4 }],

    // Diamond (White) Bonus - 8 cards
    [1, 'diamond', 0, { emerald: 1, sapphire: 1, ruby: 1, onyx: 1 }],
    [1, 'diamond', 0, { emerald: 2, sapphire: 1, ruby: 1, onyx: 1 }],
    [1, 'diamond', 0, { emerald: 2, sapphire: 2, onyx: 1 }],
    [1, 'diamond', 0, { sapphire: 1, diamond: 3, onyx: 1 }],
    [1, 'diamond', 0, { ruby: 2, onyx: 1 }],
    [1, 'diamond', 0, { sapphire: 2, onyx: 2 }],
    [1, 'diamond', 0, { sapphire: 3 }],
    [1, 'diamond', 1, { emerald: 4 }],

    // Emerald (Green) Bonus - 8 cards
    [1, 'emerald', 0, { sapphire: 1, ruby: 1, diamond: 1, onyx: 1 }],
    [1, 'emerald', 0, { sapphire: 1, ruby: 1, diamond: 1, onyx: 2 }],
    [1, 'emerald', 0, { sapphire: 1, ruby: 2, onyx: 2 }],
    [1, 'emerald', 0, { emerald: 1, sapphire: 3, diamond: 1 }],
    [1, 'emerald', 0, { sapphire: 1, diamond: 2 }],
    [1, 'emerald', 0, { sapphire: 2, ruby: 2 }],
    [1, 'emerald', 0, { ruby: 3 }],
    [1, 'emerald', 1, { onyx: 4 }],

    // Ruby (Red) Bonus - 8 cards
    [1, 'ruby', 0, { emerald: 1, sapphire: 1, diamond: 1, onyx: 1 }],
    [1, 'ruby', 0, { emerald: 1, sapphire: 1, diamond: 2, onyx: 1 }],
    [1, 'ruby', 0, { emerald: 1, diamond: 2, onyx: 2 }],
    [1, 'ruby', 0, { ruby: 1, diamond: 1, onyx: 3 }],
    [1, 'ruby', 0, { emerald: 1, sapphire: 2 }],
    [1, 'ruby', 0, { ruby: 2, diamond: 2 }],
    [1, 'ruby', 0, { diamond: 3 }],
    [1, 'ruby', 1, { diamond: 4 }],

    // ==================== LEVEL 2 (30 Cards: 6 per gem) ====================
    // Onyx (Black) Bonus - 6 cards
    [2, 'onyx', 1, { emerald: 2, sapphire: 2, diamond: 3 }],
    [2, 'onyx', 1, { emerald: 3, diamond: 3, onyx: 2 }],
    [2, 'onyx', 2, { emerald: 4, sapphire: 1, ruby: 2 }],
    [2, 'onyx', 2, { emerald: 5, ruby: 3 }],
    [2, 'onyx', 2, { diamond: 5 }],
    [2, 'onyx', 3, { onyx: 6 }],

    // Sapphire (Blue) Bonus - 6 cards
    [2, 'sapphire', 1, { emerald: 2, sapphire: 2, ruby: 3 }],
    [2, 'sapphire', 1, { emerald: 3, sapphire: 2, onyx: 3 }],
    [2, 'sapphire', 2, { sapphire: 3, diamond: 5 }],
    [2, 'sapphire', 2, { ruby: 1, diamond: 2, onyx: 4 }],
    [2, 'sapphire', 2, { sapphire: 5 }],
    [2, 'sapphire', 3, { sapphire: 6 }],

    // Diamond (White) Bonus - 6 cards
    [2, 'diamond', 1, { emerald: 3, ruby: 2, onyx: 2 }],
    [2, 'diamond', 1, { sapphire: 3, ruby: 3, diamond: 2 }],
    [2, 'diamond', 2, { emerald: 1, ruby: 4, onyx: 2 }],
    [2, 'diamond', 2, { ruby: 5, onyx: 3 }],
    [2, 'diamond', 2, { ruby: 5 }],
    [2, 'diamond', 3, { diamond: 6 }],

    // Emerald (Green) Bonus - 6 cards
    [2, 'emerald', 1, { sapphire: 3, diamond: 2, onyx: 2 }],
    [2, 'emerald', 1, { emerald: 2, ruby: 3, diamond: 3 }],
    [2, 'emerald', 2, { sapphire: 2, diamond: 4, onyx: 1 }],
    [2, 'emerald', 2, { emerald: 3, sapphire: 5 }],
    [2, 'emerald', 2, { emerald: 5 }],
    [2, 'emerald', 3, { emerald: 6 }],

    // Ruby (Red) Bonus - 6 cards
    [2, 'ruby', 1, { ruby: 2, diamond: 2, onyx: 3 }],
    [2, 'ruby', 1, { sapphire: 3, ruby: 2, onyx: 3 }],
    [2, 'ruby', 2, { emerald: 2, sapphire: 4, diamond: 1 }],
    [2, 'ruby', 2, { diamond: 3, onyx: 5 }],
    [2, 'ruby', 2, { onyx: 5 }],
    [2, 'ruby', 3, { ruby: 6 }],

    // ==================== LEVEL 3 (20 Cards: 4 per gem) ====================
    // Onyx (Black) Bonus - 4 cards
    [3, 'onyx', 3, { emerald: 5, sapphire: 3, ruby: 3, diamond: 3 }],
    [3, 'onyx', 4, { ruby: 7 }],
    [3, 'onyx', 4, { emerald: 3, ruby: 6, onyx: 3 }],
    [3, 'onyx', 5, { ruby: 7, onyx: 3 }],

    // Sapphire (Blue) Bonus - 4 cards
    [3, 'sapphire', 3, { emerald: 3, ruby: 3, diamond: 3, onyx: 5 }],
    [3, 'sapphire', 4, { diamond: 7 }],
    [3, 'sapphire', 4, { sapphire: 3, diamond: 6, onyx: 3 }],
    [3, 'sapphire', 5, { sapphire: 3, diamond: 7 }],

    // Diamond (White) Bonus - 4 cards
    [3, 'diamond', 3, { emerald: 3, sapphire: 3, ruby: 5, onyx: 3 }],
    [3, 'diamond', 4, { onyx: 7 }],
    [3, 'diamond', 4, { ruby: 3, diamond: 3, onyx: 6 }],
    [3, 'diamond', 5, { diamond: 3, onyx: 7 }],

    // Emerald (Green) Bonus - 4 cards
    [3, 'emerald', 3, { sapphire: 3, ruby: 3, diamond: 5, onyx: 3 }],
    [3, 'emerald', 4, { sapphire: 7 }],
    [3, 'emerald', 4, { emerald: 3, sapphire: 6, diamond: 3 }],
    [3, 'emerald', 5, { emerald: 3, sapphire: 7 }],

    // Ruby (Red) Bonus - 4 cards
    [3, 'ruby', 3, { emerald: 3, sapphire: 5, diamond: 3, onyx: 3 }],
    [3, 'ruby', 4, { emerald: 7 }],
    [3, 'ruby', 4, { emerald: 6, sapphire: 3, ruby: 3 }],
    [3, 'ruby', 5, { emerald: 7, ruby: 3 }]
  ];

  // 동양의 무역로(Orient) 스타일 현대 확장 특수 능력 정의
  const MODERN_ABILITIES = {
    double_bonus: {
      id: 'double_bonus',
      korName: '이중 보석 세공',
      engName: 'Double Bonus',
      badge: 'x2 보너스',
      icon: '✨',
      description: '이 카드는 영구 보석 보너스를 1개가 아닌 2개 제공합니다. (Modern 모드 전용)'
    },
    steal_token: {
      id: 'steal_token',
      korName: '무역로 약탈/보급',
      engName: 'Bonus Token',
      badge: '+1 토큰',
      icon: '🎁',
      description: '구매 즉시 은행에서 이 카드의 보너스 색상 토큰 1개를 무료로 획득합니다. (Modern 모드 전용)'
    },
    free_cascade: {
      id: 'free_cascade',
      korName: '연쇄 후원',
      engName: 'Free Cascade',
      badge: '연쇄 할인',
      icon: '⛓️',
      description: '구매 즉시 황금 조커 토큰 1개를 추가로 받거나 다음 카드 구매 시 2개 보석 할인을 받습니다. (Modern 모드 전용)'
    },
    noble_reserve: {
      id: 'noble_reserve',
      korName: '귀족 독점 초청',
      engName: 'Noble Patronage',
      badge: '+1 명성/귀족',
      icon: '👑',
      description: '구매 시 추가 명성 +1점을 즉시 획득하고 귀족 영입 우선권을 얻습니다. (Modern 모드 전용)'
    }
  };

  // 90장 카드 객체 빌드
  const gemCounters = {
    1: { emerald: 0, sapphire: 0, ruby: 0, diamond: 0, onyx: 0 },
    2: { emerald: 0, sapphire: 0, ruby: 0, diamond: 0, onyx: 0 },
    3: { emerald: 0, sapphire: 0, ruby: 0, diamond: 0, onyx: 0 }
  };

  const CARDS = RAW_CARDS.map((entry, idx) => {
    const [level, bonusGem, points, rawCost] = entry;
    const gemIdx = gemCounters[level][bonusGem]++;
    const cost = {
      emerald: rawCost.emerald || 0,
      sapphire: rawCost.sapphire || 0,
      ruby: rawCost.ruby || 0,
      diamond: rawCost.diamond || 0,
      onyx: rawCost.onyx || 0
    };
    const totalCost = cost.emerald + cost.sapphire + cost.ruby + cost.diamond + cost.onyx;
    const themeTitle = THEME_TITLES[level][bonusGem][gemIdx % THEME_TITLES[level][bonusGem].length];
    const illustType = ILLUST_TYPES[level][gemIdx % ILLUST_TYPES[level].length];

    // Modern Expansion 모드에서 활성화되는 특수 능력 배정 (전략적 카드들에 부여)
    let modernAbility = null;
    if (level === 1 && totalCost === 3) {
      modernAbility = 'steal_token'; // 단일 색상 3개짜리 1레벨 카드는 토큰 1개 페이백
    } else if (level === 2 && points === 0) {
      modernAbility = 'double_bonus';
    } else if (level === 2 && points === 1 && totalCost === 7) {
      modernAbility = 'double_bonus'; // 고비용 1점 2레벨 카드는 보너스 2배
    } else if (level === 2 && points === 2 && totalCost === 5) {
      modernAbility = 'free_cascade'; // 단일 5코스트 2레벨 카드는 연쇄 보너스
    } else if (level === 3 && points === 3) {
      modernAbility = 'noble_reserve'; // 3레벨 3점 다색 카드는 귀족/왕관 보너스
    }

    return {
      id: `card_L${level}_${String(idx + 1).padStart(2, '0')}`,
      index: idx + 1,
      level,
      bonusGem,
      bonusCountClassic: 1,
      bonusCountModern: modernAbility === 'double_bonus' ? 2 : 1,
      points,
      cost,
      totalCost,
      themeTitle,
      illustType,
      modernAbility
    };
  });

  // 3. 귀족 타일 10종 전체 데이터 (역사적 르네상스 후원자 10인, 각 3점)
  const NOBLES = [
    {
      id: 'noble_01',
      korName: '카테리나 데 메디치',
      engName: 'Catherine de’ Medici',
      title: '프랑스의 왕비 · 메디치 가문',
      points: 3,
      requirements: { emerald: 3, sapphire: 3, ruby: 3, diamond: 0, onyx: 0 },
      quote: '예술과 권력은 가장 빛나는 보석에서 탄생한다.',
      portraitType: 'medici'
    },
    {
      id: 'noble_02',
      korName: '엘리자베스 오브 오스트리아',
      engName: 'Elisabeth of Austria',
      title: '합스부르크 황실의 왕비',
      points: 3,
      requirements: { emerald: 0, sapphire: 3, ruby: 0, diamond: 3, onyx: 3 },
      quote: '순결한 다이아몬드와 깊은 사파이어의 조화.',
      portraitType: 'habsburg_queen'
    },
    {
      id: 'noble_03',
      korName: '이사벨 1세 데 카스티야',
      engName: 'Isabella I of Castile',
      title: '스페인 통일 여왕 · 신대륙 후원자',
      points: 3,
      requirements: { emerald: 0, sapphire: 0, ruby: 0, diamond: 4, onyx: 4 },
      quote: '바다 건너 신세계의 모든 보화를 짐의 궁전으로.',
      portraitType: 'isabella'
    },
    {
      id: 'noble_04',
      korName: '니콜로 마키아벨리',
      engName: 'Niccolò Machiavelli',
      title: '피렌체 공화국 외교관 · 사상가',
      points: 3,
      requirements: { emerald: 0, sapphire: 4, ruby: 0, diamond: 4, onyx: 0 },
      quote: '지혜로운 군주는 금고의 보석으로 동맹을 산다.',
      portraitType: 'machiavelli'
    },
    {
      id: 'noble_05',
      korName: '슐레이만 1세 대제',
      engName: 'Suleiman the Magnificent',
      title: '오스만 제국의 황제 · 금세공인',
      points: 3,
      requirements: { emerald: 4, sapphire: 4, ruby: 0, diamond: 0, onyx: 0 },
      quote: '동방과 서방의 모든 무역로가 짐의 손끝에서 만난다.',
      portraitType: 'suleiman'
    },
    {
      id: 'noble_06',
      korName: '안 드 브르타뉴',
      engName: 'Anne of Brittany',
      title: '브르타뉴 여공작 · 프랑스의 왕비',
      points: 3,
      requirements: { emerald: 3, sapphire: 3, ruby: 0, diamond: 3, onyx: 0 },
      quote: '자주독립의 영광을 빛낼 최고의 장인을 찾노라.',
      portraitType: 'anne'
    },
    {
      id: 'noble_07',
      korName: '카를 5세 황제',
      engName: 'Charles V, Holy Roman Emperor',
      title: '신성 로마 제국 황제 · 해가 지지 않는 제국',
      points: 3,
      requirements: { emerald: 0, sapphire: 0, ruby: 3, diamond: 3, onyx: 3 },
      quote: '내 제국에서는 결코 태양이 지지 않는다.',
      portraitType: 'charles_v'
    },
    {
      id: 'noble_08',
      korName: '프랑수아 1세',
      engName: 'Francis I of France',
      title: '발루아 왕조 · 르네상스의 아버지',
      points: 3,
      requirements: { emerald: 3, sapphire: 0, ruby: 3, diamond: 0, onyx: 3 },
      quote: '다빈치의 붓끝과 비견될 보석 세공품을 가져오라.',
      portraitType: 'francis_i'
    },
    {
      id: 'noble_09',
      korName: '헨리 8세 튜더',
      engName: 'Henry VIII of England',
      title: '잉글랜드의 국왕 · 튜더 왕조',
      points: 3,
      requirements: { emerald: 0, sapphire: 0, ruby: 4, diamond: 0, onyx: 4 },
      quote: '왕권의 위엄은 붉은 루비와 칠흑의 오닉스로 증명된다.',
      portraitType: 'henry_viii'
    },
    {
      id: 'noble_10',
      korName: '마리 스튜어트',
      engName: 'Mary, Queen of Scots',
      title: '스코틀랜드의 여왕 · 스튜어트 왕가',
      points: 3,
      requirements: { emerald: 4, sapphire: 0, ruby: 4, diamond: 0, onyx: 0 },
      quote: '하이랜드의 초록빛 대지와 왕실의 붉은 열정을 담아서.',
      portraitType: 'mary_stuart'
    }
  ];

  // 4. 게임 모드 및 규칙 설정 (Classic vs Modern Expansion)
  const GAME_MODES = {
    classic: {
      id: 'classic',
      korName: '클래식 오리지널 룰 (Classic Mode)',
      engName: 'Classic Rules',
      badge: '정통 보드게임 표준',
      summary: '전 세계적으로 사랑받는 스플렌더 오리지널 공식 규칙입니다.',
      targetPoints: 15,
      maxTokensPerTurnDiff: 3,
      maxTokensSameColor: 2,
      minBankTokensForDouble: 4,
      maxHandTokens: 10,
      maxReservedCards: 3,
      enableStrongholds: false,
      enableOrientAbilities: false,
      enableTwoPlayerJokerBonus: false,
      rulesList: [
        '인원수에 맞춰 보석 토큰(2인: 4개, 3인: 5개, 4인: 7개)과 귀족 타일(인원+1장)을 배치합니다.',
        '내 턴에는 ① 서로 다른 보석 3개 가져오기, ② 같은 보석 2개 가져오기(4개 이상 남아있을 때), ③ 카드 1장 예약+황금 토큰 획득, ④ 카드 1장 구매 중 하나를 수행합니다.',
        '보유 토큰은 황금 포함 최대 10개까지만 소지할 수 있으며, 누군가 15점을 달성하면 마지막 플레이어까지 공평하게 턴을 마친 뒤 최고 득점자가 승리합니다.'
      ]
    },
    modern: {
      id: 'modern',
      korName: '현대 확장 통합 룰 (Modern Expansion Mode)',
      engName: 'Modern Strongholds & Orient Rules',
      badge: '최신 확장팩 + 대결 특화',
      summary: '성채(Strongholds) 독점/견제 시스템과 동양의 무역로(Orient) 특수 능력, 2인 대결 개선 규칙이 결합된 전략 모드입니다.',
      targetPoints: 15, // 옵션으로 20점 변경 가능
      customTargetPointsOptions: [15, 18, 20],
      maxTokensPerTurnDiff: 3,
      maxTokensSameColor: 2,
      minBankTokensForDouble: 4,
      maxHandTokens: 10,
      maxReservedCards: 3,
      enableStrongholds: true,
      strongholdsPerPlayer: 3,
      strongholdUnlockThreshold: 3,
      enableOrientAbilities: true,
      enableTwoPlayerJokerBonus: true,
      rulesList: [
        '🏰 성채(Strongholds) 규칙: 개발 카드를 구매할 때마다 보드 위의 다른 카드 위에 내 성채를 1개 올리거나 상대 성채를 1개 제거합니다.',
        '⚡ 성채 3개 독점: 한 카드 위에 내 성채 3개가 모이면 그 카드는 나만 구매할 수 있으며, 턴 종료 시 비용을 지불해 즉시 추가 구매할 수 있습니다!',
        '✨ 동양의 무역로 특수능력: 일부 카드에 [x2 보너스], [+1 토큰 페이백], [연쇄 할인], [+1 명성] 효과가 부여됩니다.',
        '⚔️ 현대 2인 대결 보정: 2인 플레이 시 견제 밸런스를 위해 예약 시 황금 조커 활용도와 성채 견제 보너스가 극대화됩니다.'
      ]
    }
  };

  // 인원수별 초기 은행 토큰 및 귀족 타일 수 계산 함수
  function getSetupConfig(playerCount, modeId = 'classic', customOptions = {}) {
    const count = Math.max(2, Math.min(4, Number(playerCount) || 2));
    const gemCountByPlayers = { 2: 4, 3: 5, 4: 7 };
    const baseGemTokens = gemCountByPlayers[count];
    const modeConfig = GAME_MODES[modeId] || GAME_MODES.classic;

    const enableStrongholds = customOptions.enableStrongholds !== undefined
      ? Boolean(customOptions.enableStrongholds)
      : modeConfig.enableStrongholds;

    const enableOrientAbilities = customOptions.enableOrientAbilities !== undefined
      ? Boolean(customOptions.enableOrientAbilities)
      : modeConfig.enableOrientAbilities;

    const targetPoints = Number(customOptions.targetPoints) || modeConfig.targetPoints || 15;

    return {
      playerCount: count,
      modeId: modeConfig.id,
      targetPoints,
      bankTokens: {
        emerald: baseGemTokens,
        sapphire: baseGemTokens,
        ruby: baseGemTokens,
        diamond: baseGemTokens,
        onyx: baseGemTokens,
        gold: 5
      },
      nobleCount: count + 1,
      visibleCardsPerLevel: 4,
      maxTokensInHand: 10,
      maxReservedCards: 3,
      minStackForDoubleTake: 4,
      enableStrongholds,
      enableOrientAbilities,
      strongholdsPerPlayer: 3
    };
  }

  // 플레이어가 보유한 카드 보너스 합산 계산
  function getPlayerBonuses(player, enableOrientAbilities = false) {
    const bonuses = { emerald: 0, sapphire: 0, ruby: 0, diamond: 0, onyx: 0 };
    if (!player || !Array.isArray(player.purchasedCards)) return bonuses;

    for (const card of player.purchasedCards) {
      if (card && bonuses[card.bonusGem] !== undefined) {
        const amount = (enableOrientAbilities && card.modernAbility === 'double_bonus') ? 2 : 1;
        bonuses[card.bonusGem] += amount;
      }
    }
    return bonuses;
  }

  // 특정 카드를 구매하기 위해 필요한 실제 토큰 지불 비용 및 가능 여부 계산
  function evaluateCardPurchase(player, card, enableOrientAbilities = false) {
    if (!player || !card) {
      return { canAfford: false, goldNeeded: 99, availableGold: 0, missingTokens: 99, missingByGem: {}, payment: null };
    }
    const bonuses = getPlayerBonuses(player, enableOrientAbilities);
    const tokens = player.tokens || {};
    const payment = { emerald: 0, sapphire: 0, ruby: 0, diamond: 0, onyx: 0, gold: 0 };
    const missingByGem = { emerald: 0, sapphire: 0, ruby: 0, diamond: 0, onyx: 0 };
    let goldNeeded = 0;
    let totalShortfallAfterBonus = 0;

    for (const gem of GEM_KEYS) {
      const rawCost = (card.cost && card.cost[gem]) || 0;
      const discount = bonuses[gem] || 0;
      const netCost = Math.max(0, rawCost - discount);
      totalShortfallAfterBonus += netCost;

      const availableGem = tokens[gem] || 0;
      if (availableGem >= netCost) {
        payment[gem] = netCost;
      } else {
        payment[gem] = availableGem;
        const diff = netCost - availableGem;
        missingByGem[gem] = diff;
        goldNeeded += diff;
      }
    }

    const availableGold = tokens.gold || 0;
    const canAfford = goldNeeded <= availableGold;
    payment.gold = canAfford ? goldNeeded : availableGold;
    const missingTokens = Math.max(0, goldNeeded - availableGold);

    return {
      canAfford,
      goldNeeded,
      availableGold,
      missingTokens,
      missingByGem,
      totalShortfallAfterBonus,
      payment
    };
  }

  // 귀족 방문 조건 충족 여부 확인
  function getEligibleNobles(player, activeNobles, enableOrientAbilities = false) {
    if (!player || !Array.isArray(activeNobles)) return [];
    const bonuses = getPlayerBonuses(player, enableOrientAbilities);
    return activeNobles.filter((noble) => {
      if (!noble || !noble.requirements) return false;
      return GEM_KEYS.every((gem) => (bonuses[gem] || 0) >= (noble.requirements[gem] || 0));
    });
  }

  // 공식 스플렌더 카드 앞/뒤면, 귀족 타일, 보석 토큰 이미지 1:1 매핑
  const DECK_BACK_IMAGES = {
    1: 'assets/cards/green-00.jpg',
    2: 'assets/cards/yellow-00.jpg',
    3: 'assets/cards/blue-00.jpg'
  };

  const GEM_CHIP_IMAGES = {
    emerald: 'assets/gems/greenGem-removebg.png',
    sapphire: 'assets/gems/blueGem-removebg.png',
    ruby: 'assets/gems/redGem-removebg.png',
    diamond: 'assets/gems/whiteGem-removebg.png',
    onyx: 'assets/gems/blackGem-removebg.png',
    gold: 'assets/gems/goldGem-removebg.png'
  };

  const OFFICIAL_CARD_IMAGES = [
    "assets/cards/green-04.jpg","assets/cards/green-06.jpg","assets/cards/green-07.jpg","assets/cards/green-08.jpg","assets/cards/green-02.jpg","assets/cards/green-05.jpg","assets/cards/green-03.jpg","assets/cards/green-01.jpg",
    "assets/cards/green-28.jpg","assets/cards/green-30.jpg","assets/cards/green-31.jpg","assets/cards/green-32.jpg","assets/cards/green-26.jpg","assets/cards/green-29.jpg","assets/cards/green-27.jpg","assets/cards/green-25.jpg",
    "assets/cards/green-36.jpg","assets/cards/green-38.jpg","assets/cards/green-39.jpg","assets/cards/green-40.jpg","assets/cards/green-34.jpg","assets/cards/green-37.jpg","assets/cards/green-35.jpg","assets/cards/green-33.jpg",
    "assets/cards/green-20.jpg","assets/cards/green-22.jpg","assets/cards/green-23.jpg","assets/cards/green-24.jpg","assets/cards/green-18.jpg","assets/cards/green-21.jpg","assets/cards/green-19.jpg","assets/cards/green-17.jpg",
    "assets/cards/green-12.jpg","assets/cards/green-14.jpg","assets/cards/green-15.jpg","assets/cards/green-16.jpg","assets/cards/green-10.jpg","assets/cards/green-13.jpg","assets/cards/green-11.jpg","assets/cards/green-09.jpg",
    "assets/cards/yellow-05.jpg","assets/cards/yellow-06.jpg","assets/cards/yellow-03.jpg","assets/cards/yellow-04.jpg","assets/cards/yellow-02.jpg","assets/cards/yellow-01.jpg",
    "assets/cards/yellow-23.jpg","assets/cards/yellow-24.jpg","assets/cards/yellow-22.jpg","assets/cards/yellow-21.jpg","assets/cards/yellow-20.jpg","assets/cards/yellow-19.jpg",
    "assets/cards/yellow-29.jpg","assets/cards/yellow-30.jpg","assets/cards/yellow-27.jpg","assets/cards/yellow-28.jpg","assets/cards/yellow-26.jpg","assets/cards/yellow-25.jpg",
    "assets/cards/yellow-17.jpg","assets/cards/yellow-18.jpg","assets/cards/yellow-15.jpg","assets/cards/yellow-16.jpg","assets/cards/yellow-14.jpg","assets/cards/yellow-13.jpg",
    "assets/cards/yellow-11.jpg","assets/cards/yellow-12.jpg","assets/cards/yellow-09.jpg","assets/cards/yellow-10.jpg","assets/cards/yellow-08.jpg","assets/cards/yellow-07.jpg",
    "assets/cards/blue-04.jpg","assets/cards/blue-03.jpg","assets/cards/blue-02.jpg","assets/cards/blue-01.jpg",
    "assets/cards/blue-16.jpg","assets/cards/blue-15.jpg","assets/cards/blue-14.jpg","assets/cards/blue-13.jpg",
    "assets/cards/blue-20.jpg","assets/cards/blue-19.jpg","assets/cards/blue-18.jpg","assets/cards/blue-17.jpg",
    "assets/cards/blue-12.jpg","assets/cards/blue-11.jpg","assets/cards/blue-10.jpg","assets/cards/blue-09.jpg",
    "assets/cards/blue-08.jpg","assets/cards/blue-07.jpg","assets/cards/blue-06.jpg","assets/cards/blue-05.jpg"
  ];

  const OFFICIAL_NOBLE_IMAGES = {
    noble_01: 'assets/nobles/nobles-10.jpg',
    noble_02: 'assets/nobles/nobles-02.jpg',
    noble_03: 'assets/nobles/nobles-04.jpg',
    noble_04: 'assets/nobles/nobles-08.jpg',
    noble_05: 'assets/nobles/nobles-06.jpg',
    noble_06: 'assets/nobles/nobles-05.jpg',
    noble_07: 'assets/nobles/nobles-07.jpg',
    noble_08: 'assets/nobles/nobles-01.jpg',
    noble_09: 'assets/nobles/nobles-09.jpg',
    noble_10: 'assets/nobles/nobles-03.jpg'
  };

  CARDS.forEach((card, i) => {
    card.imageUrl = OFFICIAL_CARD_IMAGES[i] || DECK_BACK_IMAGES[card.level];
    card.backImageUrl = DECK_BACK_IMAGES[card.level];
  });

  NOBLES.forEach((noble) => {
    noble.imageUrl = OFFICIAL_NOBLE_IMAGES[noble.id] || 'assets/nobles/nobles-01.jpg';
  });

  ALL_TOKEN_KEYS.forEach((k) => {
    if (GEMS[k]) GEMS[k].chipImageUrl = GEM_CHIP_IMAGES[k];
  });

  const SplendorData = {
    GEMS,
    GEM_KEYS,
    ALL_TOKEN_KEYS,
    CARDS,
    NOBLES,
    DECK_BACK_IMAGES,
    GEM_CHIP_IMAGES,
    MODERN_ABILITIES,
    GAME_MODES,
    getSetupConfig,
    getPlayerBonuses,
    evaluateCardPurchase,
    getEligibleNobles
  };

  if (typeof window !== 'undefined') {
    window.SplendorData = SplendorData;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SplendorData;
  }
})(typeof window !== 'undefined' ? window : globalThis);
