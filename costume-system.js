/* =====================================================
   ハンドベル部サイト・専用衣装獲得システム
   通常抽選はベルちゃん／チャイムくんの各54枠のみ。
   イベント衣装・シークレット衣装・画像コレクションは対象外。
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
    item.placeholder !== true && typeof item.src === "string"
  );
}

export async function awardRandomCostumeOnPageOpen({
  db, ref, get, set, update,
  currentUser, profile, collectionItems,
  getCachedCollectionData, saveCollectionDataCache,
  renderCollection, updateCollectionMiniCount,
  collectionView, showCostumeGift
}) {
  if (!currentUser || !profile || !Array.isArray(collectionItems)) return null;

  try {
    const uid = currentUser.uid;
    const collectionRef = ref(db, `members/${uid}/collection`);
    const snapshot = await get(collectionRef);
    const owned = snapshot.exists() && snapshot.val() && typeof snapshot.val() === "object"
      ? snapshot.val() : {};
    const character = profile.characterType === "chime" ? "chime" : "bell";

    // 54種類の通常衣装だけを抽選。イベント／シークレットはIDで除外する。
    const available = getNormalCostumes(collectionItems, character);
    let unowned = available.filter(item => !owned[item.id]);
    let selected = null;

    if (unowned.length) {
      selected = unowned[Math.floor(Math.random() * unowned.length)];
      const record = { acquiredAt: Date.now(), source: "costume-system-test" };
      await set(ref(db, `members/${uid}/collection/${selected.id}`), record);
      owned[selected.id] = record;
      if (typeof showCostumeGift === "function") showCostumeGift(character, selected);
    }

    // チャイムくんの通常54枠をすべて所持したら、ベルちゃんの未所持通常衣装を必ず1着贈る。
    const chimeIds = Array.from({length:54}, (_, i) => `chime_costume_slot_${String(i + 1).padStart(2,"0")}`);
    const chimeComplete = chimeIds.every(id => !!owned[id]);
    if (chimeComplete) {
      const bellAvailable = getNormalCostumes(collectionItems, "bell");
      const bellUnowned = bellAvailable.filter(item => !owned[item.id]);
      if (bellUnowned.length) {
        const bellGift = bellUnowned[Math.floor(Math.random() * bellUnowned.length)];
        const record = { acquiredAt: Date.now(), source: "chime-complete-bell-guaranteed" };
        await set(ref(db, `members/${uid}/collection/${bellGift.id}`), record);
        owned[bellGift.id] = record;
        if (typeof showCostumeGift === "function") showCostumeGift("bell", bellGift);
        selected = bellGift;
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
