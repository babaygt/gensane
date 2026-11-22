// The sidebar of the documentation is open without JavaScript, so nothing is hidden; on a narrow
// screen it starts folded, as a menu.
const menu = document.querySelector(".docs-menu");
if (menu instanceof HTMLDetailsElement && matchMedia("(max-width: 60rem)").matches)
  menu.open = false;
