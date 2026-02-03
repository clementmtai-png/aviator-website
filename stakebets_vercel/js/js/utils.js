const Utils = {
    // DOM Helpers
    el: (id) => document.getElementById(id),
    show: (id) => {
        const el = Utils.el(id);
        if (el) el.classList.remove('hidden');
    },
    hide: (id) => {
        const el = Utils.el(id);
        if (el) el.classList.add('hidden');
    },

    // Formatting
    formatMoney: (val) => Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),

    // Randomization
    randomItem: (arr) => arr[Math.floor(Math.random() * arr.length)],
    randomRange: (min, max) => Math.random() * (max - min) + min,

    // Persistence
    save: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
    load: (key) => {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    }
};
