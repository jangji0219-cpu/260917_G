from flask import Flask, jsonify, render_template, request

app = Flask(__name__)


# ==========================================================================
# 지표별 점수 산정 규칙 (국내 가치투자 관점의 참고용 휴리스틱)
# 각 함수는 (점수, 코멘트)를 반환한다.
# ==========================================================================

def band_per(v):
  if v <= 0:
    return -2, '적자 상태로 이익이 없습니다.'
  if v <= 10:
    return 2, '저평가 구간입니다.'
  if v <= 15:
    return 1, '적정 밸류에이션입니다.'
  if v <= 25:
    return 0, '업종 평균 수준입니다.'
  if v <= 40:
    return -1, '다소 고평가 구간입니다.'
  return -2, '고평가 경고 구간입니다.'


def band_pbr(v):
  if v <= 0:
    return -1, '자본잠식 등 이상 신호일 수 있습니다.'
  if v <= 1:
    return 2, '자산 대비 저평가 구간입니다.'
  if v <= 1.5:
    return 1, '자산 대비 적정 구간입니다.'
  if v <= 3:
    return 0, '업종 평균 수준입니다.'
  if v <= 5:
    return -1, '자산 대비 다소 고평가입니다.'
  return -2, '자산 대비 고평가 경고입니다.'


def band_roe(v):
  if v < 0:
    return -2, '자기자본 대비 손실 상태입니다.'
  if v < 5:
    return -1, '수익성이 저조합니다.'
  if v < 10:
    return 0, '평균적인 자본 효율입니다.'
  if v < 15:
    return 1, '양호한 자본 효율입니다.'
  return 2, '우수한 자본 효율입니다.'


def band_operating_margin(v):
  if v < 0:
    return -2, '영업손실 상태입니다.'
  if v < 5:
    return -1, '영업 수익성이 낮습니다.'
  if v < 10:
    return 0, '보통 수준의 영업 수익성입니다.'
  if v < 20:
    return 1, '양호한 영업 수익성입니다.'
  return 2, '우수한 영업 수익성입니다.'


def band_debt_ratio(v):
  if v <= 50:
    return 2, '재무구조가 매우 안정적입니다.'
  if v <= 100:
    return 1, '안정적인 재무구조입니다.'
  if v <= 150:
    return 0, '보통 수준의 부채비율입니다.'
  if v <= 200:
    return -1, '다소 위험한 부채 수준입니다.'
  return -2, '재무 위험이 높은 수준입니다.'


def band_revenue_growth(v):
  if v < 0:
    return -1, '매출이 역성장하고 있습니다.'
  if v < 5:
    return 0, '매출 성장이 정체되어 있습니다.'
  if v < 15:
    return 1, '양호한 매출 성장세입니다.'
  return 2, '높은 매출 성장세입니다.'


def band_profit_growth(v):
  if v < 0:
    return -1, '영업이익이 역성장하고 있습니다.'
  if v < 10:
    return 0, '영업이익 성장이 정체되어 있습니다.'
  if v < 30:
    return 1, '양호한 이익 성장세입니다.'
  return 2, '높은 이익 성장세입니다.'


def band_dividend_yield(v):
  if v <= 1:
    return 0, '배당 매력이 크지 않습니다.'
  if v <= 3:
    return 1, '준수한 배당 수익률입니다.'
  return 2, '높은 배당 매력을 갖고 있습니다.'


# key, 라벨, 채점함수, 최소점수, 최대점수
METRICS = [
    ('per', 'PER (주가수익비율, 배)', band_per, -2, 2),
    ('pbr', 'PBR (주가순자산비율, 배)', band_pbr, -2, 2),
    ('roe', 'ROE (자기자본이익률, %)', band_roe, -2, 2),
    ('operating_margin', '영업이익률 (%)', band_operating_margin, -2, 2),
    ('debt_ratio', '부채비율 (%)', band_debt_ratio, -2, 2),
    ('revenue_growth', '매출성장률 YoY (%)', band_revenue_growth, -1, 2),
    ('profit_growth', '영업이익성장률 YoY (%)', band_profit_growth, -1, 2),
    ('dividend_yield', '배당수익률 (%)', band_dividend_yield, 0, 2),
]


def verdict_for(pct):
  if pct >= 75:
    return '강력 매수 고려', 'strong-buy'
  if pct >= 55:
    return '매수 고려', 'buy'
  if pct >= 40:
    return '중립 · 관망', 'neutral'
  if pct >= 20:
    return '신중 검토 필요', 'caution'
  return '매도 · 회피 고려', 'avoid'


# HTML 메인 페이지 렌더링
@app.route('/')
def index():
  return render_template('index.html')


# 지표 입력 → 점수/등급 산정 (서버는 상태를 저장하지 않으며, 기록은 브라우저에만 저장됩니다)
@app.route('/api/evaluate', methods=['POST'])
def evaluate():
  data = request.get_json() or {}
  ticker = (data.get('ticker') or '').strip()

  breakdown = []
  total = 0
  min_total = 0
  max_total = 0

  for key, label, band_fn, min_score, max_score in METRICS:
    raw = data.get(key)
    if raw is None or str(raw).strip() == '':
      continue
    try:
      value = float(raw)
    except (TypeError, ValueError):
      return jsonify({'error': f'{label} 값이 올바르지 않습니다.'}), 400

    score, comment = band_fn(value)
    total += score
    min_total += min_score
    max_total += max_score
    breakdown.append({
        'key': key,
        'label': label,
        'value': value,
        'score': score,
        'comment': comment,
    })

  if not breakdown:
    return jsonify({'error': '최소 1개 이상의 지표를 입력해주세요.'}), 400

  if max_total > min_total:
    pct = round((total - min_total) / (max_total - min_total) * 100, 1)
  else:
    pct = 50.0

  verdict, tier = verdict_for(pct)

  return jsonify({
      'ticker': ticker,
      'score': total,
      'percentage': pct,
      'verdict': verdict,
      'tier': tier,
      'breakdown': breakdown,
  })


if __name__ == '__main__':
  print('Starting Flask server on port 5000...')
  app.run(host='127.0.0.1', port=5000, debug=False)
