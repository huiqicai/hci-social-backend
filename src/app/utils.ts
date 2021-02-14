import { Config } from "@foal/core";

export function removeEmptyParams(obj: Record<string, unknown>) {
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
