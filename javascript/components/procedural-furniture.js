/**
 * A-Frame Component: Procedural Furniture
 * Creates furniture from primitives without needing .obj files
 */
AFRAME.registerComponent("procedural-furniture", {
  schema: {
    type: { type: "string", default: "table" },
    color: { type: "color", default: "#8B4513" },
  },

  init: function () {
    this.createFurniture();
  },

  createFurniture: function () {
    const type = this.data.type.toLowerCase();

    switch (type) {
      case "table":
      case "table1":
      case "centertable":
        this.createTable();
        break;
      case "chair":
        this.createChair();
        break;
      case "bed":
        this.createBed();
        break;
      case "desk":
        this.createDesk();
        break;
      default:
        this.createTable();
    }
  },

  createTable: function () {
    // Table top (1.2m x 0.05m x 0.8m)
    const top = document.createElement("a-box");
    top.setAttribute("width", 1.2);
    top.setAttribute("height", 0.05);
    top.setAttribute("depth", 0.8);
    top.setAttribute("position", "0 0.725 0");
    top.setAttribute("color", this.data.color);
    top.setAttribute("material", "roughness: 0.8; metalness: 0.1");
    top.setAttribute("shadow", "cast: true; receive: true");
    this.el.appendChild(top);

    // 4 legs (0.05m x 0.7m x 0.05m each)
    const legPositions = [
      [-0.55, 0.35, -0.35],
      [0.55, 0.35, -0.35],
      [-0.55, 0.35, 0.35],
      [0.55, 0.35, 0.35],
    ];

    legPositions.forEach((pos) => {
      const leg = document.createElement("a-box");
      leg.setAttribute("width", 0.05);
      leg.setAttribute("height", 0.7);
      leg.setAttribute("depth", 0.05);
      leg.setAttribute("position", `${pos[0]} ${pos[1]} ${pos[2]}`);
      leg.setAttribute("color", this.data.color);
      leg.setAttribute("material", "roughness: 0.8; metalness: 0.1");
      leg.setAttribute("shadow", "cast: true; receive: true");
      this.el.appendChild(leg);
    });

    console.log("✅ Created procedural table with 4 legs");
  },

  createChair: function () {
    const darkWood = "#654321";

    // Seat (0.45m x 0.05m x 0.45m)
    const seat = document.createElement("a-box");
    seat.setAttribute("width", 0.45);
    seat.setAttribute("height", 0.05);
    seat.setAttribute("depth", 0.45);
    seat.setAttribute("position", "0 0.45 0");
    seat.setAttribute("color", darkWood);
    seat.setAttribute("material", "roughness: 0.8; metalness: 0.1");
    seat.setAttribute("shadow", "cast: true; receive: true");
    this.el.appendChild(seat);

    // 4 legs
    const legPositions = [
      [-0.18, 0.225, -0.18],
      [0.18, 0.225, -0.18],
      [-0.18, 0.225, 0.18],
      [0.18, 0.225, 0.18],
    ];

    legPositions.forEach((pos) => {
      const leg = document.createElement("a-box");
      leg.setAttribute("width", 0.04);
      leg.setAttribute("height", 0.45);
      leg.setAttribute("depth", 0.04);
      leg.setAttribute("position", `${pos[0]} ${pos[1]} ${pos[2]}`);
      leg.setAttribute("color", darkWood);
      leg.setAttribute("material", "roughness: 0.8; metalness: 0.1");
      leg.setAttribute("shadow", "cast: true; receive: true");
      this.el.appendChild(leg);
    });

    // Backrest
    const back = document.createElement("a-box");
    back.setAttribute("width", 0.45);
    back.setAttribute("height", 0.5);
    back.setAttribute("depth", 0.05);
    back.setAttribute("position", "0 0.7 -0.2");
    back.setAttribute("color", darkWood);
    back.setAttribute("material", "roughness: 0.8; metalness: 0.1");
    back.setAttribute("shadow", "cast: true; receive: true");
    this.el.appendChild(back);

    console.log("✅ Created procedural chair");
  },

  createBed: function () {
    // Mattress
    const mattress = document.createElement("a-box");
    mattress.setAttribute("width", 2);
    mattress.setAttribute("height", 0.3);
    mattress.setAttribute("depth", 1.5);
    mattress.setAttribute("position", "0 0.45 0");
    mattress.setAttribute("color", "#FFFAF0");
    mattress.setAttribute("material", "roughness: 0.9; metalness: 0");
    mattress.setAttribute("shadow", "cast: true; receive: true");
    this.el.appendChild(mattress);

    // Frame
    const frame = document.createElement("a-box");
    frame.setAttribute("width", 2.1);
    frame.setAttribute("height", 0.3);
    frame.setAttribute("depth", 1.6);
    frame.setAttribute("position", "0 0.15 0");
    frame.setAttribute("color", "#3E2723");
    frame.setAttribute("material", "roughness: 0.7; metalness: 0.1");
    frame.setAttribute("shadow", "cast: true; receive: true");
    this.el.appendChild(frame);

    // Headboard
    const headboard = document.createElement("a-box");
    headboard.setAttribute("width", 2.1);
    headboard.setAttribute("height", 0.8);
    headboard.setAttribute("depth", 0.1);
    headboard.setAttribute("position", "0 0.7 -0.8");
    headboard.setAttribute("color", "#3E2723");
    headboard.setAttribute("material", "roughness: 0.7; metalness: 0.1");
    headboard.setAttribute("shadow", "cast: true; receive: true");
    this.el.appendChild(headboard);

    console.log("✅ Created procedural bed");
  },

  createDesk: function () {
    const lightWood = "#A0826D";

    // Desktop
    const top = document.createElement("a-box");
    top.setAttribute("width", 1.5);
    top.setAttribute("height", 0.05);
    top.setAttribute("depth", 0.7);
    top.setAttribute("position", "0 0.725 0");
    top.setAttribute("color", lightWood);
    top.setAttribute("material", "roughness: 0.7; metalness: 0.1");
    top.setAttribute("shadow", "cast: true; receive: true");
    this.el.appendChild(top);

    // 4 legs
    const legPositions = [
      [-0.7, 0.35, -0.3],
      [0.7, 0.35, -0.3],
      [-0.7, 0.35, 0.3],
      [0.7, 0.35, 0.3],
    ];

    legPositions.forEach((pos) => {
      const leg = document.createElement("a-box");
      leg.setAttribute("width", 0.05);
      leg.setAttribute("height", 0.7);
      leg.setAttribute("depth", 0.05);
      leg.setAttribute("position", `${pos[0]} ${pos[1]} ${pos[2]}`);
      leg.setAttribute("color", lightWood);
      leg.setAttribute("material", "roughness: 0.7; metalness: 0.1");
      leg.setAttribute("shadow", "cast: true; receive: true");
      this.el.appendChild(leg);
    });

    console.log("✅ Created procedural desk");
  },
});
