import Human from "@vladmandic/human";


// ========================================
// DOM
// ========================================

const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");


const status = document.getElementById("status");
const cameraStatus = document.getElementById("cameraStatus");
const cameraDot = document.getElementById("cameraDot");
const cameraText = document.getElementById("cameraText");

const recognitionName =
  document.getElementById("recognitionName");

const recognitionMessage =
  document.getElementById("recognitionMessage");

const similarity =
  document.getElementById("similarity");

const resultElement =
  document.getElementById("result");

const doorIndicator =
  document.getElementById("doorIndicator");

const doorIcon =
  document.getElementById("doorIcon");

const doorText =
  document.getElementById("doorText");

const doorSubtext =
  document.getElementById("doorSubtext");

const todayAccess =
  document.getElementById("todayAccess");

const peopleCount =
  document.getElementById("peopleCount");

const deniedCount =
  document.getElementById("deniedCount");

const aiStatus =
  document.getElementById("aiStatus");

const recentLogs =
  document.getElementById("recentLogs");

const allLogs =
  document.getElementById("allLogs");

const peopleGrid =
  document.getElementById("peopleGrid");

const personModal =
  document.getElementById("personModal");

const personName =
  document.getElementById("personName");

const personImages =
  document.getElementById("personImages");

const imagePreview =
  document.getElementById("imagePreview");

const modalStatus =
  document.getElementById("modalStatus");

const threshold =
  document.getElementById("threshold");

const thresholdValue =
  document.getElementById("thresholdValue");

const autoRecognition =
  document.getElementById("autoRecognition");

const autoDoor =
  document.getElementById("autoDoor");

const doorDuration =
  document.getElementById("doorDuration");

const loginOverlay =
  document.getElementById("loginOverlay");

const loginPassword =
  document.getElementById("loginPassword");

const loginStatus =
  document.getElementById("loginStatus");

const loginSubmit =
  document.getElementById("loginSubmit");


// ========================================
// AI
// ========================================

const humanConfig = {

  backend: "webgl",

  modelBasePath:
    "https://cdn.jsdelivr.net/npm/@vladmandic/human/models/",

  face: {

    enabled: true,

    detector: {
      rotation: true,
      maxDetected: 5
    },

    mesh: {
      enabled: true
    },

    description: {
      enabled: false
    }

  }

};


const human =
  new Human(humanConfig);


// ========================================
// Backend API
// ========================================

const API_BASE = "/api";

let authToken =
  localStorage.getItem(
    "faceguard_token"
  ) || "";


async function apiFetch(
  url,
  options = {}
) {

  const headers = {

    ...(options.headers || {}),

    Authorization:
      `Bearer ${authToken}`

  };

  return fetch(
    url,
    { ...options, headers }
  );

}


// ========================================
// App State
// ========================================

let faceDatabase = [];

let accessLogs = [];

let selectedImages = [];

let editingPersonId = null;

let lastRecognitionTime = 0;

let isDetecting = false;

let pendingCandidate = null;

let pendingCount = 0;

const CONFIRM_COUNT = 2;

const MIN_FACE_SCORE = 0.7;

const MIN_FACE_WIDTH_RATIO = 0.15;

let isRecognizing = false;


// ========================================
// Data Sync
// ========================================

async function loadData() {

  try {

    const [
      peopleResponse,
      logsResponse
    ] = await Promise.all([

      apiFetch(`${API_BASE}/people`),

      apiFetch(`${API_BASE}/logs`)

    ]);

    faceDatabase =
      await peopleResponse.json();

    accessLogs =
      await logsResponse.json();

  } catch (error) {

    console.error(
      "資料讀取失敗，請確認後端伺服器是否啟動",
      error
    );

  }

}


function startPolling() {

  setInterval(
    async () => {

      try {

        const [
          peopleResponse,
          logsResponse
        ] = await Promise.all([

          apiFetch(`${API_BASE}/people`),

          apiFetch(`${API_BASE}/logs`)

        ]);

        faceDatabase =
          await peopleResponse.json();

        accessLogs =
          await logsResponse.json();

        renderPeople();

        renderLogs();

        updateStats();

      } catch (error) {

        // 輪詢失敗時略過，等下一次重試

      }

    },
    5000
  );

}


// ========================================
// Navigation
// ========================================

const navItems =
  document.querySelectorAll(
    ".nav-item"
  );

const pages =
  document.querySelectorAll(
    ".page"
  );


const pageTitle =
  document.getElementById(
    "pageTitle"
  );

const pageDescription =
  document.getElementById(
    "pageDescription"
  );


const pageInfo = {

  dashboard: [
    "總覽",
    "即時監控門禁狀態"
  ],

  people: [
    "人員管理",
    "管理可以通過門禁的人員"
  ],

  logs: [
    "通行紀錄",
    "查看所有門禁辨識結果"
  ],

  settings: [
    "系統設定",
    "調整 FaceGuard 的辨識與門禁設定"
  ]

};


function switchPage(page) {

  pages.forEach(
    item => {

      item.classList.remove(
        "active-page"
      );

    }
  );


  navItems.forEach(
    item => {

      item.classList.remove(
        "active"
      );

    }
  );


  const target =
    document.getElementById(
      `page-${page}`
    );


  const nav =
    document.querySelector(
      `.nav-item[data-page="${page}"]`
    );


  if (target) {

    target.classList.add(
      "active-page"
    );

  }


  if (nav) {

    nav.classList.add(
      "active"
    );

  }


  if (pageInfo[page]) {

    pageTitle.textContent =
      pageInfo[page][0];

    pageDescription.textContent =
      pageInfo[page][1];

  }

}


navItems.forEach(
  item => {

    item.addEventListener(
      "click",
      () => {

        switchPage(
          item.dataset.page
        );

      }
    );

  }
);


document
  .querySelectorAll(
    "[data-page]"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.page;

          switchPage(page);

        }
      );

    }
  );


// ========================================
// Camera
// ========================================

async function getCamera() {

  try {

    const stream =
      await navigator.mediaDevices
        .getUserMedia({

          video: {
            facingMode: "user"
          },

          audio: false

        });


    video.srcObject =
      stream;


    await video.play();


    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;


    cameraDot.classList.add(
      "active"
    );

    cameraText.textContent =
      "攝影機運作中";

    cameraStatus.textContent =
      "運作中";

    cameraStatus.className =
      "badge success";


    detectCamera();

  } catch (error) {

    console.error(error);

    cameraText.textContent =
      "無法取得攝影機";

    cameraStatus.textContent =
      "錯誤";

    cameraStatus.className =
      "badge danger";

  }

}


// ========================================
// Face Detection
// ========================================

async function detectCamera() {

  if (
    isDetecting ||
    !autoRecognition.checked
  ) {

    requestAnimationFrame(
      detectCamera
    );

    return;
  }


  isDetecting = true;


  try {

    const result =
      await human.detect(video);


    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    if (
      result.face &&
      result.face.length > 0
    ) {

      ctx.save();

      ctx.translate(
        canvas.width,
        0
      );

      ctx.scale(-1, 1);


      for (
        const face of result.face
      ) {

        const box =
          face.box;


        ctx.strokeStyle =
          "#35d39a";

        ctx.lineWidth = 3;


        ctx.strokeRect(
          box[0],
          box[1],
          box[2],
          box[3]
        );

      }

      ctx.restore();


      if (
        faceDatabase.length === 0
      ) {

        recognitionName.textContent =
          "尚未註冊";

        recognitionMessage.textContent =
          "請先新增人員";

        similarity.textContent =
          "--";

      } else {

        const primaryFace =
          result.face[0];

        const faceWidthRatio =
          primaryFace.box[2] /
          canvas.width;

        const isGoodQuality =
          primaryFace.score >=
          MIN_FACE_SCORE &&
          faceWidthRatio >=
          MIN_FACE_WIDTH_RATIO;


        if (!isGoodQuality) {

          recognitionName.textContent =
            "畫質不足";

          recognitionMessage.textContent =
            "請靠近並正對鏡頭";

          similarity.textContent =
            "--";

          cameraStatus.textContent =
            "請靠近";

          cameraStatus.className =
            "badge waiting";

        } else {

          const now =
            Date.now();


          if (
            now -
            lastRecognitionTime >
            1200
          ) {

            lastRecognitionTime =
              now;


            recognizeFace(
              captureFrame()
            );

          }

        }

      }

    } else {

      recognitionName.textContent =
        "尚未辨識";

      recognitionMessage.textContent =
        "請面向攝影機";

      similarity.textContent =
        "--";

      cameraStatus.textContent =
        "等待人臉";

      cameraStatus.className =
        "badge waiting";

    }

  } catch (error) {

    console.error(error);

  }


  isDetecting = false;


  requestAnimationFrame(
    detectCamera
  );

}


// ========================================
// Recognition
// ========================================

function captureFrame() {

  const captureCanvas =
    document.createElement(
      "canvas"
    );

  captureCanvas.width =
    video.videoWidth;

  captureCanvas.height =
    video.videoHeight;

  captureCanvas
    .getContext("2d")
    .drawImage(
      video,
      0,
      0,
      captureCanvas.width,
      captureCanvas.height
    );

  return captureCanvas.toDataURL(
    "image/jpeg",
    0.85
  );

}


async function recognizeFace(
  imageDataURL
) {

  if (isRecognizing) {
    return;
  }

  isRecognizing = true;


  let result;

  try {

    const response =
      await apiFetch(
        `${API_BASE}/recognize`,
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            image: imageDataURL
          })

        }
      );

    if (!response.ok) {
      throw new Error(
        "辨識服務錯誤"
      );
    }

    result =
      await response.json();

  } catch (error) {

    console.error(
      "辨識失敗",
      error
    );

    recognitionMessage.textContent =
      "⚠️ 辨識服務無法連線";

    isRecognizing = false;

    return;
  }

  isRecognizing = false;


  if (result.faces !== 1) {

    // 畫面雜訊或多人，這次不算數，等下一次
    return;
  }


  const bestMatch = result.match;

  const score =
    bestMatch
      ? bestMatch.score
      : 0;

  const percentage =
    Math.round(
      score * 100
    );


  similarity.textContent =
    bestMatch
      ? `${percentage}%`
      : "--";


  const currentThreshold =
    Number(
      threshold.value
    );

  const passed =
    !!bestMatch &&
    score >= currentThreshold;

  const candidate =
    passed
      ? bestMatch.name
      : null;


  if (
    candidate ===
    pendingCandidate
  ) {

    pendingCount++;

  } else {

    pendingCandidate =
      candidate;

    pendingCount = 1;

  }


  if (
    pendingCount <
    CONFIRM_COUNT
  ) {

    recognitionName.textContent =
      passed
        ? bestMatch.name
        : "未知人物";

    recognitionMessage.textContent =
      "🔄 確認中...";

    cameraStatus.textContent =
      "確認中";

    cameraStatus.className =
      "badge waiting";

    return;
  }


  if (passed) {

    recognitionName.textContent =
      bestMatch.name;

    recognitionMessage.textContent =
      "✓ 身份驗證成功";

    cameraStatus.textContent =
      "驗證成功";

    cameraStatus.className =
      "badge success";


    resultElement.textContent =
      `🟢 ${bestMatch.name} 通過`;


    if (
      autoDoor.checked
    ) {

      openDoor(
        bestMatch.name
      );

    }


  } else {

    recognitionName.textContent =
      "未知人物";

    recognitionMessage.textContent =
      "✕ 身份驗證失敗";

    cameraStatus.textContent =
      "拒絕";

    cameraStatus.className =
      "badge danger";


    resultElement.textContent =
      "🔴 未授權";


    addLog(
      "未知人物",
      false,
      score
    );

  }


  pendingCandidate = null;

  pendingCount = 0;

}


// ========================================
// Door
// ========================================

function openDoor(name) {

  doorIndicator.textContent =
    "已解鎖";

  doorIndicator.className =
    "door-indicator open";


  doorIcon.textContent =
    "🔓";

  doorIcon.className =
    "door-icon open";


  doorText.textContent =
    "門已解鎖";

  doorSubtext.textContent =
    `${name} 通過驗證`;


  addLog(
    name,
    true,
    null
  );


  const duration =
    Number(
      doorDuration.value
    );


  setTimeout(
    lockDoor,
    duration * 1000
  );

}


function lockDoor() {

  doorIndicator.textContent =
    "已鎖定";

  doorIndicator.className =
    "door-indicator locked";


  doorIcon.textContent =
    "🔒";

  doorIcon.className =
    "door-icon locked";


  doorText.textContent =
    "門已鎖定";

  doorSubtext.textContent =
    "等待授權";

}


// ========================================
// Logs
// ========================================

async function addLog(
  name,
  success,
  score
) {

  try {

    const response =
      await apiFetch(
        `${API_BASE}/logs`,
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            name,
            success,
            score
          })

        }
      );

    const log =
      await response.json();

    accessLogs.unshift(
      log
    );

    if (
      accessLogs.length > 200
    ) {

      accessLogs =
        accessLogs.slice(
          0,
          200
        );

    }

  } catch (error) {

    console.error(
      "紀錄寫入失敗",
      error
    );

  }


  renderLogs();

  updateStats();

}


function renderLogs() {

  if (
    accessLogs.length === 0
  ) {

    recentLogs.innerHTML =
      `<div class="empty">
        尚無通行紀錄
      </div>`;

    allLogs.innerHTML =
      `<div class="empty">
        尚無紀錄
      </div>`;

    return;
  }


  const createHTML =
    log => {

      const scoreText =
        log.score === null
          ? ""
          : ` · ${Math.round(
              log.score * 100
            )}%`;


      const timeText =
        new Date(
          log.time
        ).toLocaleString(
          "zh-TW"
        );


      return `
        <div class="log-item">

          <div class="log-avatar">
            ${log.success ? "✓" : "!"}
          </div>

          <div class="log-info">

            <div class="log-name">
              ${escapeHTML(log.name)}
            </div>

            <div class="log-time">
              ${timeText}${scoreText}
            </div>

          </div>

          <div
            class="log-result ${
              log.success
                ? "success"
                : "denied"
            }"
          >
            ${
              log.success
                ? "通過"
                : "拒絕"
            }
          </div>

        </div>
      `;

    };


  recentLogs.innerHTML =
    accessLogs
      .slice(0, 5)
      .map(createHTML)
      .join("");


  allLogs.innerHTML =
    accessLogs
      .map(createHTML)
      .join("");

}


function escapeHTML(text) {

  const div =
    document.createElement(
      "div"
    );

  div.textContent =
    text;

  return div.innerHTML;

}


function shrinkImageToDataURL(
  image,
  maxWidth = 320,
  quality = 0.8
) {

  const scale =
    Math.min(
      1,
      maxWidth / image.width
    );

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    image.width * scale;

  canvas.height =
    image.height * scale;

  const context =
    canvas.getContext("2d");

  context.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas.toDataURL(
    "image/jpeg",
    quality
  );

}


// ========================================
// People
// ========================================

function renderPeople() {

  peopleCount.textContent =
    faceDatabase.length;


  if (
    faceDatabase.length === 0
  ) {

    peopleGrid.innerHTML =
      `<div class="empty-card">
        尚未建立人員
      </div>`;

    return;

  }


  peopleGrid.innerHTML =
    faceDatabase
      .map(
        (person, index) => {

          return `
            <div class="person-card">

              <div class="person-photo">

                ${
                  person.photo
                    ? `
                      <img
                        src="${person.photo}"
                        alt="${escapeHTML(
                          person.name
                        )}"
                      >
                    `
                    : "👤"
                }

              </div>

              <div class="person-body">

                <div class="person-name">
                  ${escapeHTML(
                    person.name
                  )}
                </div>

                <div class="person-meta">
                  ${
                    person.embeddings.length
                  } 張註冊照片
                </div>

                <div class="person-status">
                  已授權
                </div>

                <div class="person-actions">

                  <button
                    class="person-action-btn"
                    data-action="add-photo"
                    data-id="${person.id}"
                  >
                    ＋ 新增照片
                  </button>

                  <button
                    class="person-action-btn danger"
                    data-action="delete"
                    data-id="${person.id}"
                  >
                    刪除
                  </button>

                </div>

              </div>

            </div>
          `;

        }
      )
      .join("");

}


// ========================================
// Add Person Modal
// ========================================

const addPersonButton =
  document.getElementById(
    "addPersonButton"
  );

const closeModal =
  document.getElementById(
    "closeModal"
  );

const cancelModal =
  document.getElementById(
    "cancelModal"
  );

const savePerson =
  document.getElementById(
    "savePerson"
  );

const modalTitle =
  document.getElementById(
    "modalTitle"
  );

const modalSubtitle =
  document.getElementById(
    "modalSubtitle"
  );


function openModal() {

  editingPersonId = null;

  personModal.classList.remove(
    "hidden"
  );

  personName.value = "";

  personImages.value = "";

  selectedImages = [];

  imagePreview.innerHTML = "";

  modalStatus.textContent = "";

  modalTitle.textContent =
    "新增人員";

  modalSubtitle.textContent =
    "建立人臉辨識資料";

  savePerson.textContent =
    "建立人員";

}


function openAddPhotoModal(id) {

  const person =
    faceDatabase.find(
      p => p.id === id
    );

  if (!person) {
    return;
  }

  editingPersonId = id;

  personModal.classList.remove(
    "hidden"
  );

  personName.value =
    person.name;

  personImages.value = "";

  selectedImages = [];

  imagePreview.innerHTML = "";

  modalStatus.textContent = "";

  modalTitle.textContent =
    "新增照片";

  modalSubtitle.textContent =
    `為「${person.name}」新增更多辨識照片`;

  savePerson.textContent =
    "新增照片";

}


async function deletePerson(id) {

  const person =
    faceDatabase.find(
      p => p.id === id
    );

  if (!person) {
    return;
  }

  if (
    !confirm(
      `確定要刪除「${person.name}」嗎？此操作無法復原。`
    )
  ) {
    return;
  }

  try {

    await apiFetch(
      `${API_BASE}/people/${id}`,
      { method: "DELETE" }
    );

  } catch (error) {

    console.error(
      "刪除人員失敗",
      error
    );

    return;
  }

  faceDatabase =
    faceDatabase.filter(
      p => p.id !== id
    );

  renderPeople();

  updateStats();

}


function closePersonModal() {

  editingPersonId = null;

  personModal.classList.add(
    "hidden"
  );

}


addPersonButton.addEventListener(
  "click",
  openModal
);


peopleGrid.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-action]"
      );

    if (!button) {
      return;
    }

    const id =
      button.dataset.id;

    const action =
      button.dataset.action;

    if (action === "delete") {

      deletePerson(id);

    } else if (
      action === "add-photo"
    ) {

      openAddPhotoModal(id);

    }

  }
);


closeModal.addEventListener(
  "click",
  closePersonModal
);


cancelModal.addEventListener(
  "click",
  closePersonModal
);


personImages.addEventListener(
  "change",
  () => {

    selectedImages =
      Array.from(
        personImages.files
      );


    imagePreview.innerHTML = "";


    for (
      const file
      of selectedImages
    ) {

      const image =
        document.createElement(
          "img"
        );


      image.src =
        URL.createObjectURL(
          file
        );


      imagePreview.appendChild(
        image
      );

    }

  }
);


// ========================================
// Create Person
// ========================================

savePerson.addEventListener(
  "click",
  async () => {

    const name =
      personName.value.trim();


    if (!name) {

      modalStatus.textContent =
        "❌ 請輸入姓名";

      return;

    }


    if (
      selectedImages.length === 0
    ) {

      modalStatus.textContent =
        "❌ 請至少選擇一張照片";

      return;

    }


    modalStatus.textContent =
      "⏳ 上傳並分析照片中...";


    const photos = [];

    let displayPhoto = null;


    try {

      for (
        const file of selectedImages
      ) {

        const image =
          new Image();


        image.src =
          URL.createObjectURL(
            file
          );


        await image.decode();


        photos.push(
          shrinkImageToDataURL(
            image,
            1024,
            0.85
          )
        );


        if (!displayPhoto) {

          displayPhoto =
            shrinkImageToDataURL(
              image
            );

        }

      }

    } catch (error) {

      console.error(
        "照片處理失敗",
        error
      );

      modalStatus.textContent =
        "❌ 照片處理失敗，請確認照片格式";

      return;
    }


    const endpoint =
      editingPersonId
        ? `${API_BASE}/people/${editingPersonId}`
        : `${API_BASE}/people`;

    const method =
      editingPersonId
        ? "PATCH"
        : "POST";


    try {

      const response =
        await apiFetch(
          endpoint,
          {

            method,

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              name,
              photos,
              photo: displayPhoto
            })

          }
        );

      const body =
        await response.json();

      if (!response.ok) {

        throw new Error(
          body.error ||
          "上傳失敗"
        );

      }

      if (editingPersonId) {

        const index =
          faceDatabase.findIndex(
            p =>
              p.id ===
              editingPersonId
          );

        if (index !== -1) {

          faceDatabase[index] =
            body;

        }

        modalStatus.textContent =
          `✅ 新增成功，共新增 ${body.addedCount} 張有效照片`;

      } else {

        faceDatabase.push(
          body
        );

        modalStatus.textContent =
          `✅ 建立成功，共 ${body.addedCount} 張有效照片`;

      }

      renderPeople();

      updateStats();

    } catch (error) {

      console.error(error);

      modalStatus.textContent =
        `❌ ${error.message || "上傳到伺服器失敗，請確認伺服器是否啟動"}`;

      return;
    }


    setTimeout(
      closePersonModal,
      1000
    );

  }
);


// ========================================
// Settings
// ========================================

threshold.addEventListener(
  "input",
  () => {

    thresholdValue.textContent =
      Number(
        threshold.value
      ).toFixed(2);

  }
);


// ========================================
// Clear Logs
// ========================================

document
  .getElementById("clearLogs")
  .addEventListener(
    "click",
    async () => {

      if (
        !confirm(
          "確定要清除所有通行紀錄嗎？"
        )
      ) {

        return;

      }

      try {

        await apiFetch(
          `${API_BASE}/logs`,
          { method: "DELETE" }
        );

      } catch (error) {

        console.error(
          "清除紀錄失敗",
          error
        );

      }


      accessLogs = [];

      renderLogs();

      updateStats();

    }
  );


// ========================================
// Stats
// ========================================

function updateStats() {

  peopleCount.textContent =
    faceDatabase.length;


  const now = new Date();


  const todayLogs =
    accessLogs.filter(
      log => {

        const logDate =
          new Date(log.time);

        return (
          logDate.getFullYear() ===
            now.getFullYear() &&
          logDate.getMonth() ===
            now.getMonth() &&
          logDate.getDate() ===
            now.getDate()
        );

      }
    );


  const success =
    todayLogs.filter(
      log => log.success
    ).length;


  const denied =
    todayLogs.filter(
      log => !log.success
    ).length;


  todayAccess.textContent =
    success;


  deniedCount.textContent =
    denied;

}


// ========================================
// Login Gate
// ========================================

async function checkAuth() {

  try {

    const response =
      await apiFetch(
        `${API_BASE}/people`
      );

    return response.ok;

  } catch (error) {

    return false;
  }

}


function requireLogin() {

  return new Promise(
    async resolve => {

      const authorized =
        await checkAuth();

      if (authorized) {

        resolve();

        return;
      }

      loginOverlay.classList.remove(
        "hidden"
      );


      async function attemptLogin() {

        const password =
          loginPassword.value;

        authToken = password;

        loginStatus.textContent =
          "⏳ 驗證中...";

        const ok =
          await checkAuth();

        if (ok) {

          localStorage.setItem(
            "faceguard_token",
            password
          );

          loginOverlay.classList.add(
            "hidden"
          );

          resolve();

        } else {

          loginStatus.textContent =
            "❌ 密碼錯誤";

        }

      }


      loginSubmit.addEventListener(
        "click",
        attemptLogin
      );

      loginPassword.addEventListener(
        "keydown",
        event => {

          if (event.key === "Enter") {
            attemptLogin();
          }

        }
      );

    }
  );

}


// ========================================
// Start
// ========================================

async function init() {

  await requireLogin();

  await loadData();

  renderPeople();

  renderLogs();

  updateStats();

  startPolling();


  aiStatus.textContent =
    "載入中";


  status.textContent =
    "⏳ 載入 AI 模型...";


  try {

    await human.load();

    await human.warmup();


    aiStatus.textContent =
      "Online";


    status.textContent =
      "✅ AI 模型已準備";


    await getCamera();

  } catch (error) {

    console.error(error);

    aiStatus.textContent =
      "Offline";

    status.textContent =
      "❌ AI 初始化失敗";

  }

}

init();