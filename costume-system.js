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
  if (!currentUser) {
    console.warn("衣装テスト獲得を中止: ログインユーザーがありません。");
    return null;
  }
  if (!profile) {
    console.warn("衣装テスト獲得を中止: プロフィールがありません。");
    return null;
  }
  if (!Array.isArray(collectionItems)) {
    console.error("衣装テスト獲得を中止: collectionItems が配列ではありません。");
    return null;
  }

  // 今のキャラクター設定に対応する通常衣装だけを抽選対象にする。
  const character = profile.characterType === "chime" ? "chime" : "bell";
  const group = character;
  const available = collectionItems.filter(item =>
    item && item.group === group && typeof item.id === "string" && typeof item.src === "string"
  );
  if (!available.length) {
    console.error("衣装テスト獲得を中止: 対象衣装が0件です。", { character, characterType: profile.characterType });
    return null;
  }

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
      console.info("衣装テスト獲得をスキップ: 対象衣装はすべて獲得済みです。", { character, availableCount: available.length });
      return { character, alreadyOwned: true, availableCount: available.length };
    }

    const selected = unowned[Math.floor(Math.random() * unowned.length)];
    const record = { acquiredAt: Date.now(), source: "costume-system-test" };
    // Firebaseへの保存が成功してから、キャッシュと演出を更新する。
    await set(ref(db, `members/${uid}/collection/${selected.id}`), record);

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

    console.info("衣装テスト獲得:", character, selected.id);
    return { character, costumeId: selected.id };
  } catch (error) {
    console.error("専用衣装システムの獲得エラー:", error);
    // 失敗を無言で隠さず、ページ上でも原因確認のきっかけを表示する。
    const message = error && error.code === "PERMISSION_DENIED"
      ? "衣装を保存できませんでした。Firebaseのデータベースルールを確認してください。"
      : "衣装を獲得できませんでした。ページを再読み込みし、もう一度お試しください。";
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
