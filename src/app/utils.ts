import { Config } from "@foal/core";
import { Connection } from "typeorm";

export function removeEmptyParams<T extends Record<string, unknown>>(obj: T): Partial<T> {
    let newObj = {};
    Object.keys(obj).forEach((key) => {
        if (obj[key] === Object(obj[key])) {
            const subObj = removeEmptyParams(obj[key] as Record<string, unknown>);
            if (Object.keys(subObj).length > 0) newObj[key] = subObj;
        } else if (obj[key] !== undefined) newObj[key] = obj[key];
    });
    return newObj;
}

export function getDateTimeType() {
    // We're using an ancient version of mariadb which doesn't support CURRENT_TIMESTAMP on
    if (Config.getOrThrow('database.type', 'string') === 'mariadb') {
        return 'timestamp';
    }
    return 'datetime';
}

export async function fkFixedSync(conn: Connection) {
    // Derived from https://github.com/typeorm/typeorm/issues/2576#issuecomment-499506647
    const isSQLite = Config.getOrThrow('database.type', 'string') === 'sqlite';
    if (isSQLite) await conn.query('PRAGMA foreign_keys=OFF');
    await conn.synchronize();
    if (isSQLite) await conn.query('PRAGMA foreign_keys=ON');
}
