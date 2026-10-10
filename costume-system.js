/* =====================================================
   ハンドベル部サイト・専用衣装獲得システム
   テストモード：ログイン後、ページを開くたびに
   選択中キャラクターの未取得衣装を1着獲得。
   既存のシークレット衣装抽選とは独立して動作します。
===================================================== */

export async function awardRandomCostumeOnPageOpen({
  db,
  ref,
  get,
  set,
  currentUser,
  profile,
  collectionItems,
  getCachedCollectionData,
  saveCollectionDataCache,
  renderCollection,
  updateCollectionMiniCount,
  collectionView,
  showCostumeGift
}) {
  // iPadでも原因を確認できるよう、処理状況を画面に表示する診断パネル。
  const report = (message, kind = "info") => {
    console[kind === "error" ? "error" : "info"]("衣装テスト診断: " + message);
    if (typeof document === "undefined" || !document.body) return;
    let panel = document.getElementById("costumeTestDiagnosticNotice");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "costumeTestDiagnosticNotice";
      panel.setAttribute("role", "status");
      panel.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:100101;padding:14px 16px 14px;border-radius:12px;background:#fff;color:#222;border:2px solid #4776c5;box-shadow:0 4px 20px #0003;font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere";
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "閉じる";
      close.style.cssText = "float:right;margin-left:12px;padding:5px 10px;border:1px solid #aaa;border-radius:8px;background:#f5f5f5;color:#222";
      close.addEventListener("click", () => panel.remove());
      const content = document.createElement("div");
      content.id = "costumeTestDiagnosticText";
      panel.append(close, content);
      document.body.appendChild(panel);
    }
    const content = panel.querySelector("#costumeTestDiagnosticText");
    if (content) content.textContent = "衣装獲得テストの確認
" + message;
    panel.style.borderColor = kind === "error" ? "#bd3333" : (kind === "success" ? "#27834a" : "#4776c5");
  };

  report("獲得処理を開始しました。");
  if (!currentUser) {
    report("停止：ログインユーザーが取得できていません。ログイン状態を確認してください。", "error");
    return null;
  }
  report("ログイン確認OK（UID末尾：" + String(currentUser.uid || "").slice(-6) + "）。");
  if (!profile) {
    report("停止：プロフィールがまだ取得できていません。", "error");
    return null;
  }
  if (!Array.isArray(collectionItems)) {
    report("停止：衣装一覧データが読み込まれていません。", "error");
    return null;
  }

  // 今のキャラクター設定に対応する通常衣装だけを抽選対象にする。
  const character = profile.characterType === "chime" ? "chime" : "bell";
  const group = character;
  const available = collectionItems.filter(item =>
    item && item.group === group && typeof item.id === "string" && typeof item.src === "string"
  );
  if (!available.length) {
    report("停止：キャラクター「" + character + "」用の衣装が一覧に0件です。プロフィールのcharacterType=" + String(profile.characterType), "error");
    return null;
  }
  report("キャラクター判定OK（" + character + "）。衣装一覧 " + available.length + " 件を確認しました。Firebaseの所持データを読み込みます。");

  try {
    const uid = currentUser.uid;
    const collectionRef = ref(db, `members/${uid}/collection`);
    const snapshot = await get(collectionRef);
    const owned = snapshot.exists() && snapshot.val() && typeof snapshot.val() === "object"
      ? snapshot.val()
      : {};

    // 所持済みを除外し、重複獲得を防ぐ。
    const unowned = available.filter(item => !owned[item.id]);
    if (!unowned.length) {
      report("今回は新規獲得されませんでした。対象の衣装 " + available.length + " 件は、Firebase上ですべて獲得済みになっています。", "error");
      return { character, alreadyOwned: true, availableCount: available.length };
    }

    report("未取得衣装を " + unowned.length + " 件確認しました。1着を選び、Firebaseに保存します。");
    const selected = unowned[Math.floor(Math.random() * unowned.length)];
    const record = { acquiredAt: Date.now(), source: "costume-system-test" };
    // Firebaseへの保存が成功してから、キャッシュと演出を更新する。
    await set(ref(db, `members/${uid}/collection/${selected.id}`), record);
    report("Firebaseへの保存に成功しました：" + selected.id + "。コレクション表示を更新します。", "success");

    const cached = getCachedCollectionData() || {};
    cached[selected.id] = record;
    saveCollectionDataCache(uid, cached);

    if (collectionView && !collectionView.classList.contains("hidden")) {
      await renderCollection();
    }
    if (typeof updateCollectionMiniCount === "function") updateCollectionMiniCount();

    // テスト獲得時も、ユーザーに衣装獲得演出を表示する。
    if (typeof showCostumeGift === "function") {
      showCostumeGift(character, selected);
    }

    report("獲得成功：" + selected.name + "（ID: " + selected.id + "）。演出を呼び出しました。", "success");
    console.info("衣装テスト獲得:", character, selected.id);
    return { character, costumeId: selected.id };
  } catch (error) {
    console.error("専用衣装システムの獲得エラー:", error);
    report("エラー発生：" + String(error && (error.code || error.message) || error), "error");
    // 失敗を無言で隠さず、ページ上でも原因確認のきっかけを表示する。
    const message = error && (error.code === "PERMISSION_DENIED" || String(error.code || "").includes("permission-denied"))
      ? "衣装を保存できませんでした。Firebaseのデータベースルールを確認してください。"
      : "衣装を獲得できませんでした。診断パネルのエラー内容を確認してください。";
    if (typeof document !== "undefined" && document.body) {
      const old = document.getElementById("costumeTestErrorNotice");
      if (old) old.remove();
      const notice = document.createElement("div");
      notice.id = "costumeTestErrorNotice";
      notice.textContent = message;
      notice.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:100100;padding:14px 16px;border-radius:12px;background:#fff0f0;color:#8b1e1e;box-shadow:0 4px 20px #0003;font-size:14px;line-height:1.5";
      document.body.appendChild(notice);
      window.setTimeout(() => notice.remove(), 7000);
    }
    return null;
  }
}
