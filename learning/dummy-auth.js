const users = [
    { id: 1, username: 'admin', role: 'superuser' },
    { id: 2, username: 'guest', role: 'viewer' }
];

export function login(username, password) {
    if (!password) {
        throw new Error("Password is required");
    }
    const user = users.find(u => u.username === username);
    
    if (user && password === 'secret123') {
        return { success: true, token: `fake-jwt-for-${user.id}` };
    }
    return { success: false, error: "Invalid credentials" };
}

export function checkRole(userId) {
    const user = users.find(u => u.id === userId);
    return user ? user.role : 'unknown';
}