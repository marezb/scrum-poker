export const POKER_CARDS = ['0.5', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?'];
export const ADMIN_PASSWORD = "AskMarekForApproval";

export function generateId(length = 10) {
    return Math.random().toString(36).substring(2, 2 + length);
}
