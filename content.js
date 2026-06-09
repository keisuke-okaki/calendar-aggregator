{
  function aggregateCalendarHours() {
    // 1. config.js の読み込みチェック
    if (!window.MY_CALENDAR_CONFIG || !window.MY_CALENDAR_CONFIG.CATEGORY_MAP) {
      console.log("...config.jsの読み込みを待機中...");
      return;
    }

    const config = window.MY_CALENDAR_CONFIG;
    const CATEGORY_MAP = config.CATEGORY_MAP;
    const DEFAULT_CODE = config.DEFAULT_CODE;

    // 2. ユーザーに本日の総稼働時間を入力してもらうポップアップ
    const userInput = prompt("本日の総稼働時間を入力してください（例: 8:57 や 8.5）\n※未入力の場合は 8時間(8.00h) として計算します", "8:00");

    let inputHours = 8.0;

    if (userInput && userInput.trim() !== "") {
      const cleanInput = userInput.trim();
      if (cleanInput.includes(":")) {
        const parts = cleanInput.split(":");
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        inputHours = h + (m / 60);
      } else {
        inputHours = parseFloat(cleanInput) || 8.0;
      }
    }

    const oldPanel = document.getElementById('mtg-summary-panel');
    if (oldPanel) oldPanel.remove();

    console.log("=== 🔍 カレンダー工数自動集計 開始 ===");

    // 3. 今日の「年」「月」「日」を取得
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // 4. .XuJrye の要素を全取得
    const eventElements = document.querySelectorAll('.XuJrye');
    console.log(`[結果] 画面内から合計 ${eventElements.length} 個の要素を発見。解析を開始します。`);

    let summary = {};
    CATEGORY_MAP.forEach(item => summary[item.code] = 0);
    summary[DEFAULT_CODE] = 0;
    let totalHours = 0;

    // 5. 予定の判定ループ
    eventElements.forEach((el, idx) => {
      if (el.offsetWidth === 0 && el.offsetHeight === 0) return;

      let labelText = el.getAttribute('aria-label') || el.innerText || "";
      labelText = labelText.trim();
      if (!labelText) return;

      // 【件名の抽出】「」の中身を抜く
      const titleMatch = labelText.match(/「(.*?)」/);
      const title = titleMatch ? titleMatch[1] : "タイトルなし";
      const logPrefix = `【要素 #${idx + 1}】[${title}]`;

      // --- 当日・承諾の判定 ---
      let isToday = false;
      const dateMatch = labelText.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
      if (dateMatch) {
        const itemYear = parseInt(dateMatch[1], 10);
        const itemMonth = parseInt(dateMatch[2], 10);
        const itemDay = parseInt(dateMatch[3], 10);
        if (itemYear === currentYear && itemMonth === currentMonth && itemDay === currentDay) {
          isToday = true;
        }
      }
      if (labelText.includes("今日")) isToday = true;

      const isAccepted = labelText.includes("承諾");

      // 【ログ】条件に合わずに除外された理由を出力
      if (!isToday) {
        return; // 今日以外の他曜日のログは邪魔になるので出さない
      }
      if (!isAccepted) {
        console.log(`${logPrefix} ❌ 除外: 「承諾」されていません。`);
        return;
      }

      // 時間の抽出と24時間制への変換
      const timeRangeMatch = labelText.match(/(午前|午後)\s*(\d{1,2})(?::(\d{2}))?時?～(午前|午後)\s*(\d{1,2})(?::(\d{2}))?時?/);
      if (!timeRangeMatch) {
        console.log(`${logPrefix} ⚠️ 警告: 時間の形式が解析できませんでした。`);
        return;
      }

      const startAmpm = timeRangeMatch[1];
      let startHour = parseInt(timeRangeMatch[2], 10);
      const startMin = timeRangeMatch[3] ? parseInt(timeRangeMatch[3], 10) : 0;

      const endAmpm = timeRangeMatch[4];
      let endHour = parseInt(timeRangeMatch[5], 10);
      const endMin = timeRangeMatch[6] ? parseInt(timeRangeMatch[6], 10) : 0;

      if (startAmpm === "午後" && startHour < 12) startHour += 12;
      if (endAmpm === "午後" && endHour < 12) endHour += 12;
      if (startAmpm === "午前" && startHour === 12) startHour = 0;
      if (endAmpm === "午前" && endHour === 12) endHour = 0;

      const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      if (durationMinutes <= 0 || durationMinutes > 1440) return;
      const durationHours = durationMinutes / 60;

      // カテゴリ判定
      let matchedCode = null;
      for (let item of CATEGORY_MAP) {
        const hasKeyword = item.keywords.some(kw => title.toLowerCase().includes(kw.toLowerCase()));
        if (hasKeyword) {
          matchedCode = item.code;
          break;
        }
      }

      const finalCode = matchedCode || DEFAULT_CODE;
      summary[finalCode] = (summary[finalCode] || 0) + durationHours;
      totalHours += durationHours;

      // 【ログ】合格した今日の予定をタイトル付きで出力
      console.log(`${logPrefix} ⭕ 集計成功 -> 工数: ${durationHours}h (${startHour}:${String(startMin).padStart(2, '0')}～${endHour}:${String(endMin).padStart(2, '0')}) | コード: [${finalCode}]`);
    });

    // 入力された稼働時間からMTG合計を引き算
    const otherHours = Math.max(0, inputHours - totalHours);

    // 最終結果ログ
    console.log(`=== 📊 集計結果データ ===`);
    console.log(`・入力された総稼働: ${inputHours.toFixed(2)}h`);
    console.log(`・うちMTG合計: ${totalHours.toFixed(2)}h`);
    console.log(`・MTG以外の時間: ${otherHours.toFixed(2)}h`);
    console.log(`=========================`);

    // パネルの描画
    createSummaryPanel(summary, totalHours, inputHours, otherHours);
    console.log("=== 🔍 カレンダー工数自動集計 完了 ===");
  }

  // 表示パネルの作成
  function createSummaryPanel(summary, total, inputHours, other) {
    const panel = document.createElement('div');
    panel.id = 'mtg-summary-panel';
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: white;
      border: 2px solid #1a73e8;
      border-radius: 8px;
      padding: 14px;
      z-index: 999999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      font-family: Arial, sans-serif;
      font-size: 13px;
      color: #3c4043;
      min-width: 200px;
    `;

    let html = `<div style="font-weight:bold; border-bottom:1px solid #dadce0; padding-bottom:6px; margin-bottom:6px; color:#1a73e8; text-align:center;">今日の稼働工数</div>`;

    const sortedCodes = Object.keys(summary).sort();
    sortedCodes.forEach(code => {
      if (summary[code] > 0) {
        html += `<div style="margin: 4px 0; display:flex; justify-content:space-between;">
          <span style="color:#5f6368;">カテゴリ [${code}]:</span> <strong>${summary[code].toFixed(2)} h</strong>
        </div>`;
      }
    });

    html += `
      <div style="margin-top:6px; padding-top:6px; border-top:1px solid #dadce0; display:flex; justify-content:space-between; color:#1e8e3e; font-weight:bold;">
        <span>MTG合計時間:</span> <span>${total.toFixed(2)} h</span>
      </div>
      <div style="margin-top:4px; display:flex; justify-content:space-between; color:#5f6368; font-size:11px;">
        <span>指定した稼働時間:</span> <span>${inputHours.toFixed(2)} h</span>
      </div>
      <div style="margin-top:4px; padding-top:4px; border-top:1px dashed #dadce0; display:flex; justify-content:space-between; color:#b06000; font-weight:bold;">
        <span>MTG以外の時間:</span> <span>${other.toFixed(2)} h</span>
      </div>
    `;

    panel.innerHTML = html;
    document.body.appendChild(panel);
  }

  // カレンダー読み込み完了を待つため、ページを開いて2秒後に「1回だけ」実行
  setTimeout(aggregateCalendarHours, 2000);
}
