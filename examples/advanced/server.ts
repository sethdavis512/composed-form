import index from './index.html';

Bun.serve({
    routes: {
        '/': index
    },
    development: {
        hmr: true,
        console: true
    },
    port: 3101
});

console.log('Advanced example → http://localhost:3101');
