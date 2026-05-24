const b = require('bcryptjs');
const password = 'password123';
const dbHash = '$2a$10$4.lX4AIz6xJ4ZC1nYxSB1ulPksr5jgLClmFFxQbr1/IPlRlmD.f0C';
console.log('Hash length:', dbHash.length);
console.log('Matches:', b.compareSync(password, dbHash));
