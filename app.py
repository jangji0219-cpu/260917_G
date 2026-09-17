from datetime import datetime
import os
import sqlite3
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), 'todos.db')


def get_db_connection():
  conn = sqlite3.connect(DB_PATH)
  conn.row_factory = sqlite3.Row
  return conn


def init_db():
  with get_db_connection() as conn:
    conn.execute("""
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT DEFAULT '일반',
                priority TEXT DEFAULT 'medium',
                due_date TEXT,
                completed INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    # 기본 샘플 데이터가 없으면 추가
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM todos')
    if cursor.fetchone()[0] == 0:
      sample_todos = [
          (
              'Flask 웹 애플리케이션 아키텍처 완성',
              'REST API 설계 및 DB 연동 완료하기',
              '업무',
              'high',
              datetime.now().strftime('%Y-%m-%d'),
              1,
          ),
          (
              '모던 UI/UX 스타일링 및 애니메이션 적용',
              '글래스모피즘과 다크/라이트 테마 완성',
              '개발',
              'medium',
              datetime.now().strftime('%Y-%m-%d'),
              0,
          ),
          (
              '할 일 관리 기능 테스트 및 검증',
              '추가, 완료 토글, 삭제 및 통계 동작 확인',
              '테스트',
              'high',
              datetime.now().strftime('%Y-%m-%d'),
              0,
          ),
          (
              '물 2리터 마시기 및 가벼운 스트레칭',
              '건강 관리 및 휴식 챙기기',
              '건강',
              'low',
              datetime.now().strftime('%Y-%m-%d'),
              0,
          ),
      ]
      conn.executemany(
          """
                INSERT INTO todos (title, description, category, priority, due_date, completed)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
          sample_todos,
      )
      conn.commit()


# HTML 메인 페이지 렌더링
@app.route('/')
def index():
  return render_template('index.html')


# 1. 할 일 목록 조회 (필터링 & 검색 지원)
@app.route('/api/todos', methods=['GET'])
def get_todos():
  status = request.args.get('status', 'all')  # all, active, completed
  category = request.args.get('category', 'all')
  priority = request.args.get('priority', 'all')
  search = request.args.get('search', '').strip()

  query = 'SELECT * FROM todos WHERE 1=1'
  params = []

  if status == 'active':
    query += ' AND completed = 0'
  elif status == 'completed':
    query += ' AND completed = 1'

  if category and category != 'all':
    query += ' AND category = ?'
    params.append(category)

  if priority and priority != 'all':
    query += ' AND priority = ?'
    params.append(priority)

  if search:
    query += ' AND (title LIKE ? OR description LIKE ?)'
    params.append(f'%{search}%')
    params.append(f'%{search}%')

  # 완료되지 않은 항목 먼저, 그 다음 우선순위(high > medium > low), 최신순 정렬
  query += """ ORDER BY completed ASC, 
                 CASE priority 
                     WHEN 'high' THEN 1 
                     WHEN 'medium' THEN 2 
                     WHEN 'low' THEN 3 
                     ELSE 4 
                 END ASC, 
                 id DESC"""

  with get_db_connection() as conn:
    todos = conn.execute(query, params).fetchall()
    return jsonify([dict(row) for row in todos])


# 2. 새 할 일 생성
@app.route('/api/todos', methods=['POST'])
def create_todo():
  data = request.get_json() or {}
  title = data.get('title', '').strip()

  if not title:
    return jsonify({'error': '할 일 제목은 필수 입력 항목입니다.'}), 400

  description = data.get('description', '').strip()
  category = data.get('category', '일반').strip() or '일반'
  priority = data.get('priority', 'medium').strip().lower()
  if priority not in ['low', 'medium', 'high']:
    priority = 'medium'
  due_date = data.get('due_date', '').strip() or None

  with get_db_connection() as conn:
    cursor = conn.cursor()
    cursor.execute(
        """
            INSERT INTO todos (title, description, category, priority, due_date, completed)
            VALUES (?, ?, ?, ?, ?, 0)
        """,
        (title, description, category, priority, due_date),
    )
    conn.commit()
    new_id = cursor.lastrowid
    new_todo = conn.execute(
        'SELECT * FROM todos WHERE id = ?', (new_id,)
    ).fetchone()
    return jsonify(dict(new_todo)), 201


# 3. 완료 상태 토글
@app.route('/api/todos/<int:todo_id>/toggle', methods=['PATCH'])
def toggle_todo(todo_id):
  with get_db_connection() as conn:
    todo = conn.execute(
        'SELECT * FROM todos WHERE id = ?', (todo_id,)
    ).fetchone()
    if not todo:
      return jsonify({'error': '해당 할 일을 찾을 수 없습니다.'}), 404

    new_completed = 0 if todo['completed'] else 1
    conn.execute(
        'UPDATE todos SET completed = ? WHERE id = ?', (new_completed, todo_id)
    )
    conn.commit()

    updated = conn.execute(
        'SELECT * FROM todos WHERE id = ?', (todo_id,)
    ).fetchone()
    return jsonify(dict(updated))


# 4. 할 일 수정
@app.route('/api/todos/<int:todo_id>', methods=['PUT'])
def update_todo(todo_id):
  data = request.get_json() or {}
  title = data.get('title', '').strip()

  if not title:
    return jsonify({'error': '할 일 제목은 필수 입력 항목입니다.'}), 400

  description = data.get('description', '').strip()
  category = data.get('category', '일반').strip() or '일반'
  priority = data.get('priority', 'medium').strip().lower()
  if priority not in ['low', 'medium', 'high']:
    priority = 'medium'
  due_date = data.get('due_date', '').strip() or None

  with get_db_connection() as conn:
    todo = conn.execute(
        'SELECT * FROM todos WHERE id = ?', (todo_id,)
    ).fetchone()
    if not todo:
      return jsonify({'error': '해당 할 일을 찾을 수 없습니다.'}), 404

    conn.execute(
        """
            UPDATE todos 
            SET title = ?, description = ?, category = ?, priority = ?, due_date = ?
            WHERE id = ?
        """,
        (title, description, category, priority, due_date, todo_id),
    )
    conn.commit()

    updated = conn.execute(
        'SELECT * FROM todos WHERE id = ?', (todo_id,)
    ).fetchone()
    return jsonify(dict(updated))


# 5. 할 일 삭제
@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
  with get_db_connection() as conn:
    todo = conn.execute(
        'SELECT * FROM todos WHERE id = ?', (todo_id,)
    ).fetchone()
    if not todo:
      return jsonify({'error': '해당 할 일을 찾을 수 없습니다.'}), 404

    conn.execute('DELETE FROM todos WHERE id = ?', (todo_id,))
    conn.commit()
    return jsonify({'success': True, 'message': '삭제되었습니다.'})


# 6. 완료된 항목 일괄 삭제
@app.route('/api/todos/clear-completed', methods=['POST'])
def clear_completed():
  with get_db_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('DELETE FROM todos WHERE completed = 1')
    deleted_count = cursor.rowcount
    conn.commit()
    return jsonify(
        {'success': True, 'message': f'{deleted_count}개 항목이 정리되었습니다.'}
    )


# 7. 대시보드 통계 요약
@app.route('/api/stats', methods=['GET'])
def get_stats():
  with get_db_connection() as conn:
    total = conn.execute('SELECT COUNT(*) FROM todos').fetchone()[0]
    completed = conn.execute(
        'SELECT COUNT(*) FROM todos WHERE completed = 1'
    ).fetchone()[0]
    active = total - completed
    rate = round((completed / total * 100), 1) if total > 0 else 0

    categories = conn.execute(
        'SELECT DISTINCT category FROM todos'
    ).fetchall()
    category_list = [row['category'] for row in categories]

    return jsonify({
        'total': total,
        'completed': completed,
        'active': active,
        'completion_rate': rate,
        'categories': category_list,
    })


if __name__ == '__main__':
  init_db()
  print('Starting Flask server on port 5000...')
  app.run(host='127.0.0.1', port=5000, debug=False)
