import { useState, useEffect } from "react";

let cache = null;

export default function useGroupMappings() {
  const [mappings, setMappings] = useState(cache || {});
  const [loaded, setLoaded] = useState(!!cache);

  useEffect(() => {
    if (cache) return;
    fetch("/api/groups/mappings")
      .then((r) => r.json())
      .then((data) => {
        const map = {};
        data.forEach((m) => { map[m.groupId] = m.groupName; });
        cache = map;
        setMappings(map);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function resolve(groupId) {
    return mappings[groupId] || groupId || "-";
  }

  return { resolve, loaded };
}
