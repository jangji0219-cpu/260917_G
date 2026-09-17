from flask import Flask, render_template

app = Flask(__name__)


# HTML 메인 페이지 렌더링 (모든 데이터는 브라우저 localStorage에 저장됨)
@app.route('/')
def index():
  return render_template('index.html')


if __name__ == '__main__':
  print('Starting Flask server on port 5000...')
  app.run(host='127.0.0.1', port=5000, debug=False)
