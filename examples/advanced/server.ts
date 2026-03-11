import index from './index.html';

Bun.serve({
    routes: {
        '/': index
    },
    development: {
        hmr: true,
        console: true
    }
});

console.log('Advanced example → http://localhost:3000');
