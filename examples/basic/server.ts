import index from './index.html';

Bun.serve({
    routes: {
        '/': index
    },
    development: {
        hmr: true,
        console: true
    },
    port: 3100
});

console.log('Example running at http://localhost:3100');
