// Рабочее имя-заглушка. Когда у мастера появится название, меняем только здесь
window.BRAND = {
  name: 'ШОВ',
  tagline: 'мастерская кожаных изделий',
};

document.querySelectorAll('[data-brand]').forEach((el) => {
  el.textContent = window.BRAND.name;
});
document.querySelectorAll('[data-brand-tagline]').forEach((el) => {
  el.textContent = window.BRAND.tagline;
});
