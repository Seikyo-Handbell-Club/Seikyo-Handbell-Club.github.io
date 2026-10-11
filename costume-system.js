/* =====================================================
   ハンドベル部サイト・専用衣装獲得システム
   通常抽選はベルちゃん／チャイムくんの各54枠のみ。
   イベント衣装・シークレット衣装は通常抽選の対象外。
===================================================== */

const NORMAL_COSTUME_ID = {
  bell: /^bell_costume_slot_(?:0[1-9]|[1-4][0-9]|5[0-4])$/,
  chime: /^chime_costume_slot_(?:0[1-9]|[1-4][0-9]|5[0-4])$/
};

function getNormalCostumes(collectionItems, character) {
  const pattern = NORMAL_COSTUME_ID[character];
  if (!pattern) return [];
  return collectionItems.filter(item =>
    item && item.group === character && pattern.test(item.id) &&
    item.placeholder !== true && typeof item.src === "string" && item.src.length > 0
  );
}

export async function awardRandomCostumeOnPageOpen({
  db, ref, get, set,
  currentUser, profile, collectionItems,
  getCachedCollectionData, saveCollectionDataCache,
  renderCollection, updateCollectionMiniCount,
  collectionView, showCostumeGift
}) {
  if (!currentUser || !profile || !Array.isArray(collectionItems)) return null;

  try {
    const uid = currentUser.uid;
    const snapshot = await get(ref(db, `members/${uid}/collection`));
    const owned = snapshot.exists() && snapshot.val() && typeof snapshot.val() === "object"
      ? snapshot.val() : {};
    const character = profile.characterType === "chime" ? "chime" : "bell";
    const available = getNormalCostumes(collectionItems, character);
    const unowned = available.filter(item => !owned[item.id]);
    let selected = null;

    if (unowned.length) {
      selected = unowned[Math.floor(Math.random() * unowned.length)];
      const record = { acquiredAt: Date.now(), source: "costume-system-test" };
      await set(ref(db, `members/${uid}/collection/${selected.id}`), record);
      owned[selected.id] = record;
      if (typeof showCostumeGift === "function") showCostumeGift(character, selected);
    }

    // チャイムくんの通常衣装54枠をコンプリートしたら、ベルちゃんの未取得通常衣装を1着贈る。
    const chimeIds = Array.from({ length: 54 }, (_, i) => `chime_costume_slot_${String(i + 1).padStart(2, "0")}`);
    const chimeComplete = chimeIds.every(id => !!owned[id]);
    // 完了後のベルちゃんプレゼントは一度だけ。最後のチャイムくん衣装と同時に
    // 2つの演出が重ならないよう、次回ページを開いたときに贈る。
    const completionGiftRef = ref(db, `members/${uid}/costumeSystem/chimeCompleteBellGifted`);
    const completionGiftSnapshot = await get(completionGiftRef);
    const completionGiftAlreadySent = completionGiftSnapshot.exists() && completionGiftSnapshot.val() === true;
    if (chimeComplete && !completionGiftAlreadySent && !selected) {
      const bellUnowned = getNormalCostumes(collectionItems, "bell").filter(item => !owned[item.id]);
      if (bellUnowned.length) {
        const bellGift = bellUnowned[Math.floor(Math.random() * bellUnowned.length)];
        const record = { acquiredAt: Date.now(), source: "chime-complete-bell-guaranteed" };
        await set(ref(db, `members/${uid}/collection/${bellGift.id}`), record);
        await set(completionGiftRef, true);
        owned[bellGift.id] = record;
        if (typeof showCostumeGift === "function") showCostumeGift("bell", bellGift);
        selected = bellGift;
      } else {
        // ベルちゃん通常衣装もすべて所持済みなら、完了済みとして記録して再判定を防ぐ。
        await set(completionGiftRef, true);
      }
    }

    if (selected) {
      const cached = getCachedCollectionData() || {};
      Object.assign(cached, owned);
      saveCollectionDataCache(uid, cached);
    }
    if (collectionView && !collectionView.classList.contains("hidden") && typeof renderCollection === "function") {
      await renderCollection();
    }
    if (typeof updateCollectionMiniCount === "function") updateCollectionMiniCount();
    return selected ? { character: selected.group, costumeId: selected.id } : null;
  } catch (error) {
    console.error("専用衣装システムの獲得エラー:", error);
    return null;
  }
}
