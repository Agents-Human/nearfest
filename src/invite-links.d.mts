export function roomInvite(origin: string, kind: 'party' | 'club' | 'room', id: string, invite?: string): string;
export function socialInvites(url: string, title: string): {name: string; href: string}[];
