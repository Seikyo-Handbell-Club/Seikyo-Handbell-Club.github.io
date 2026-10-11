/* =====================================================
   サイト共通テスト日付設定
   テストするときは TEST_DATE を "2026-10-31" のように変更。
   通常運用に戻すときは null。
   TEST_DATE を設定するとサイト内の対応ページで共通の日付として使われます。
   一時的にURL末尾へ ?testDate=2026-10-31 を付ける方法もあります（TEST_DATE が null の場合）。
===================================================== */
(function(){
  const TEST_DATE = null; // ← 日付をまとめて変更する場所
  function parseDate(value){
    if(!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const d = new Date(value + 'T12:00:00');
    if(Number.isNaN(d.getTime()) || d.getFullYear() !== +value.slice(0,4) || d.getMonth()+1 !== +value.slice(5,7) || d.getDate() !== +value.slice(8,10)) return null;
    return d;
  }
  function getTestDate(){
    if(TEST_DATE) { const d=parseDate(TEST_DATE); if(d) return d; }
    try { const d=parseDate(new URLSearchParams(location.search).get('testDate')); if(d) return d; } catch(e) {}
    return null;
  }
  window.getSiteTestDate = getTestDate;
  window.getSiteDate = function(){ return getTestDate() || new Date(); };
})();
