export function initBloodFlow(canvas) {
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const bloodDrops = [];
  const maxDrops = 120;

  class BloodDrop {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * -canvas.height;
      this.length = 10 + Math.random() * 40;
      this.speed = 2 + Math.random() * 3;
      this.alpha = 0.6 + Math.random() * 0.4;
      this.radius = 1 + Math.random() * 1.5;
      this.glow = Math.random() < 0.2;
    }

    update() {
      this.y += this.speed;
      if (this.y > canvas.height + this.length) {
        this.reset();
      }
    }

    draw() {
      const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.length);
      gradient.addColorStop(0, `rgba(255,0,0,${this.alpha})`);
      gradient.addColorStop(1, `rgba(90,0,0,0)`);

      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = this.radius;
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x, this.y + this.length);
      ctx.stroke();

      // glow effect
      if (this.glow) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 0, 0, 0.15)`;
        ctx.arc(this.x, this.y + this.length, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (let i = 0; i < maxDrops; i++) {
    bloodDrops.push(new BloodDrop());
  }

  function animate() {
    ctx.fillStyle = "rgba(10, 0, 0, 0.2)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    bloodDrops.forEach((drop) => {
      drop.update();
      drop.draw();
    });

    requestAnimationFrame(animate);
  }

  animate();

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}
