const API_URL = "https://opentdb.com/api.php?amount=10&category=15&type=multiple";

// Elements (referencias a elementos del DOM)
const startBtn     = document.getElementById('start-btn');
const restartBtn   = document.getElementById('restart-btn');
const app          = document.getElementById('app');
const quizCont     = document.getElementById('quiz-container');
const startScreen  = document.getElementById('start-screen');
const endScreen    = document.getElementById('end-screen');
const questionArea = document.getElementById('question-area');
const answersDiv   = document.getElementById('answers');
const scoreSpan    = document.getElementById('score');
const progressBar  = document.getElementById('progress');
const finalScore   = document.getElementById('final-score');

const floatingCoversContainer = document.getElementById('floating-covers');

// Estado del juego
let questions = [], score = 0, current = 0, bestScore = 0;

/* ============================
   Eventos: iniciar / reiniciar
   ============================ */
// Cuando se hace click en "Commencer le quiz" o "Rejouer"
startBtn.addEventListener('click', startQuiz);
restartBtn.addEventListener('click', startQuiz);

/* Inicia el quiz: prepara UI y carga preguntas */
function startQuiz() {
  // Oculta/pone visible las pantallas correspondientes
  startScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  quizCont.classList.remove('hidden');

  // Reinicia estado
  score = 0;
  current = 0;
  scoreSpan.textContent = score;

  // Solicita preguntas a la API
  fetchQuestions();
}

/* Solicita las preguntas desde la API remota (OpenTDB) y prepara el array questions.
   - Decodifica entidades HTML recibidas (ej: &quot;) para mostrarlas correctamente.
   - Mezcla las respuestas para que la posición correcta sea aleatoria.
*/
function fetchQuestions() {
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      questions = data.results.map(q => ({
        question: decodeHTML(q.question),
        correct: decodeHTML(q.correct_answer),
        answers: shuffle([decodeHTML(q.correct_answer), ...q.incorrect_answers.map(decodeHTML)])
      }));
      // Mostrar la primera pregunta
      showQuestion();
    })
    .catch(err => {
      // Manejo básico de errores (puedes mostrar UI amigable aquí)
      console.error('Error fetching questions', err);
    });
}

/* Muestra la pregunta actual y las respuestas en la interfaz.
   - Actualiza la barra de progreso.
   - Crea botones para cada respuesta.
*/
function showQuestion() {
  // Si se acabaron las preguntas, finaliza el quiz
  if (current >= questions.length) {
    endQuiz();
    return;
  }

  const q = questions[current];
  document.getElementById('question').textContent = q.question;
  answersDiv.innerHTML = '';

  // Actualiza la barra de progreso (ancho en %)
  progressBar.style.width = `${((current+1)/questions.length)*100}%`;

  // Crear un botón por cada respuesta disponible
  q.answers.forEach(ans => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = ans;
    // Al hacer click, llamamos a answerClick indicando si es correcta
    btn.onclick = () => answerClick(btn, ans === q.correct);
    answersDiv.appendChild(btn);
  });
}

/* Handler para cuando el usuario selecciona una respuesta.
   - Deshabilita los botones para evitar varios clicks.
   - Marca visualmente la respuesta correcta/incorrecta.
   - Actualiza el puntaje si corresponde.
   - Avanza a la siguiente pregunta tras un breve retardo.
*/
function answerClick(btn, isCorrect) {
  // Deshabilitar todos los botones para prevenir múltiples selecciones
  Array.from(answersDiv.children).forEach(b => b.disabled = true);

  // Añadir clase visual según si la respuesta fue correcta o no
  btn.classList.add(isCorrect ? 'correct' : 'incorrect');

  // Si se falló, marcar también la respuesta correcta en verde
  if (!isCorrect) {
    Array.from(answersDiv.children).forEach(b => {
      if (b.textContent === questions[current].correct) {
        b.classList.add('correct');
      }
    });
  }

  // Incrementar la puntuación si respondió bien
  if (isCorrect) score++;
  scoreSpan.textContent = score;

  // Pequeña pausa para mostrar el feedback visual, luego avanzar
  setTimeout(() => {
    current++;
    showQuestion();
  }, 900);
}

/* Finaliza el quiz: muestra pantalla de fin y guarda mejor puntaje en localStorage */
function endQuiz() {
  quizCont.classList.add('hidden');
  endScreen.classList.remove('hidden');

  finalScore.textContent = `Votre score : ${score} / ${questions.length}`;

  // Guardar mejor puntuación
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('trivia_best_score', bestScore);
  }
}

/* =========================
   Helpers utilitarios
   ========================= */

/* Decodifica entidades HTML (ej: &quot;, &amp;) usando un textarea temporal.
   Esto evita que se muestren las entidades en bruto en las preguntas/respuestas.
*/
function decodeHTML(html) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

/* Mezcla un array in-place usando el algoritmo de Fisher-Yates.
   Devuelve el mismo array mezclado.
*/
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/* =========================
   FLOATING COVERS STREAM
   (stream de imágenes locales que suben en el fondo)
   ========================= */

// Rutas a tus imágenes locales en /covers
const coverItems = [
  // Reemplaza estas rutas por tus imágenes reales
  'covers/cover-mario.webp',
  'covers/cover-halo.webp',
  'covers/cover-zelda.webp',
  'covers/cover-doom.webp',
  'covers/cover-sonic.webp'
];

// Configuración (ajusta según prefieras)
const spawnInterval = 600;       // ms entre nuevos spawns (reduce para más densidad)
const initialBurst = 10;         // cuántas aparecen al inicio
const minDuration = 10;          // duración mínima de subida (s)
const maxDuration = 22;          // duración máxima (s)
const minSize = 70;              // anchura mínima en px
const maxSize = 150;             // anchura máxima en px

let spawnTimer = null;

/* Devuelve un número aleatorio entre min (incl) y max (excl).
   Se usa para randomizar tamaño, posición, duración, etc.
*/
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

/* Crea y lanza una portada <img> en el contenedor floatingCoversContainer.
   - Respeta la preferencia de usuario 'prefers-reduced-motion'.
   - Asigna propiedades visuales aleatorias.
   - Se elimina del DOM cuando termina la animación para liberar memoria.
*/
function spawnCover() {
  // Si el usuario prefiere menos movimiento, no generamos portadas
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq && mq.matches) return;

  if (!coverItems || coverItems.length === 0) return;

  const src = coverItems[Math.floor(Math.random() * coverItems.length)];
  const img = document.createElement('img');
  img.className = 'cover-sprite';
  img.src = src;
  img.alt = 'Portada';
  img.loading = 'lazy';

  // Aleatorizamos propiedades visuales
  const leftPercent = Math.round(rand(3, 97)); // evita bordes extremos
  const sizePx = Math.round(rand(minSize, maxSize));
  const duration = Math.round(rand(minDuration, maxDuration) * 10) / 10; // 1 decimal
  const delay = 0; // sin retraso

  img.style.left = `${leftPercent}%`;
  img.style.width = `${sizePx}px`;
  img.style.height = `${Math.round(sizePx * 1.4)}px`;
  img.style.opacity = `${rand(0.85, 1)}`;

  // Asignamos la animación de subida con duración aleatoria
  img.style.animation = `float-up ${duration}s linear ${delay}s forwards`;

  // Cuando termina la animación, eliminar el nodo para liberar memoria
  const onAnimEnd = () => {
    img.removeEventListener('animationend', onAnimEnd);
    if (img.parentNode) img.parentNode.removeChild(img);
  };
  img.addEventListener('animationend', onAnimEnd);

  floatingCoversContainer.appendChild(img);
}

/* Inicia el flujo de portadas:
   - Hace un burst inicial para poblar el fondo.
   - Inicia un intervalo periódico para seguir generando.
*/
function startCoverStream() {
  // burst inicial con pequeños retrasos entre cada creación
  for (let i = 0; i < initialBurst; i++) {
    setTimeout(spawnCover, i * (spawnInterval / Math.max(2, initialBurst)));
  }
  // spawn continuo
  spawnTimer = setInterval(spawnCover, spawnInterval);
}

/* Detiene el stream de portadas (limpia el intervalo) */
function stopCoverStream() {
  if (spawnTimer) {
    clearInterval(spawnTimer);
    spawnTimer = null;
  }
}

/* Inicializar al cargar: arrancar el stream de portadas */
startCoverStream();

/* Pausar el stream cuando la pestaña esté oculta y reanudar al volver.
   Esto ahorra CPU y batería cuando el usuario no está viendo la pestaña.
*/
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCoverStream();
  else if (!spawnTimer) startCoverStream();
});

/* Notas:
 - Controla la densidad bajando spawnInterval o initialBurst.
 - Ajusta min/maxDuration para que suban más rápido/lento.
 - Si alguna imagen no carga, revisa la ruta y extensión en coverItems y que existan los ficheros.
*/

/* =========================
   Almacenamiento: cargar mejor puntuación al inicio
   ========================= */
(function() {
  // Cargar mejor puntuación guardada en localStorage (si existe)
  bestScore = parseInt(localStorage.getItem('trivia_best_score') || "0", 10);
})();