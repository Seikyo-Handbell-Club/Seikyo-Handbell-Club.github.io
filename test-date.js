/* =====================================================
   サイト共通テスト日付設定
   テストするときは TEST_DATE を "2026-10-31" のように変更。
   通常運用に戻すときは null。
   TEST_DATE を設定するとサイト内の対応ページで共通の日付として使われます。
   一時的にURL末尾へ ?testDate=2026-10-31 を付ける方法もあります（TEST_DATE が null の場合）。iframe内のページも親ページのURLから読み取ります。
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

    // まず現在のページのURLを確認する。
    try {
      const d=parseDate(new URLSearchParams(window.location.search).get('testDate'));
      if(d) return d;
    } catch(e) {}

    // handbell.html から design.html などを iframe で開いている場合、
    // testDate は親ページのURLに付いていて、iframe側のURLには付かない。
    // 同一サイト内の親ページからもテスト日付を読む。
    try {
      if(window.parent && window.parent !== window) {
        const d=parseDate(new URLSearchParams(window.parent.location.search).get('testDate'));
        if(d) return d;
      }
    } catch(e) {}

    // トップページ側に設定がある構成にも対応する。
    try {
      if(window.top && window.top !== window && window.top !== window.parent) {
        const d=parseDate(new URLSearchParams(window.top.location.search).get('testDate'));
        if(d) return d;
      }
    } catch(e) {}

    return null;
  }
  window.getSiteTestDate = getTestDate;
  window.getSiteDate = function(){ return getTestDate() || new Date(); };
})();
