const tables=new Set(['skill_rooms','multiplayer_rooms']);
export async function listRoomRecords(store,table,user,{mine=false}={}){
 if(!tables.has(table))throw Error('Unknown room table.');
 if(mine&&!user)return [];
 const member=JSON.stringify([{id:user?.id||''}]),membership="(json::jsonb->'players') @> $1::jsonb";
 const scope=mine?membership:"((json::jsonb->>'visibility'='public' AND json::jsonb->>'status' IN ('lobby','playing')) OR "+membership+")";
 const rows=(await store.db.query("SELECT json FROM "+table+" WHERE ((json::jsonb->>'entry')::numeric=0 OR json::jsonb->>'near'='true') AND "+scope+' ORDER BY created_order DESC LIMIT $2',[member,mine?1000:200])).rows.map(row=>JSON.parse(row.json));
 await store.hydrateRooms(rows);return rows;
}
