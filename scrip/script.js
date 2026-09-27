const checkbox = document.getElementById('cyber-toggle');
const currentTheme = localStorage.getItem('theme');
const passInput = document.getElementById('pass');
const btnEye = document.getElementById('btn-eye');
if (currentTheme === 'dark') {
  document.body.classList.add('dark-mode'); 
  if (checkbox) checkbox.checked = true;    
}
if (checkbox) {
  checkbox.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
      localStorage.setItem('theme', 'dark'); 
    } else {
      localStorage.setItem('theme', 'light'); 
    }
  });
}

if (passInput && btnEye) {
  passInput.addEventListener('input', () => {
    if (passInput.value.length > 0) {
      btnEye.style.display = 'flex'; 
    } else {
      btnEye.style.display = 'none'; 
    }
  });
  btnEye.addEventListener('click', () => {
    const eyeOpenIcon = btnEye.querySelector('.eye-open');
    const eyeClosedIcon = btnEye.querySelector('.eye-closed');

    if (passInput.type === 'password') {
      passInput.type = 'text';
      eyeOpenIcon.style.display = 'none';
      eyeClosedIcon.style.display = 'block';
    } else {
      passInput.type = 'password';
      eyeOpenIcon.style.display = 'block';
      eyeClosedIcon.style.display = 'none';
    }
  });
}
const formulario = document.querySelector('form');

if (formulario) {
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault(); 
    console.log("recarga");
  });
}
const btnIngresar = document.querySelector('.cyber-btn');

if (btnIngresar) {
  btnIngresar.addEventListener('click', (evento) => {
    evento.preventDefault();
    window.location.href = "principal.html"; 
  });
}