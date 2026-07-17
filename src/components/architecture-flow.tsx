"use client";

import { motion } from "framer-motion";
import { Cpu, Laptop, ShieldCheck } from "lucide-react";

const nodes = [
  {
    icon: Laptop,
    step: "Step 1",
    title: "Your device",
    caption: "Identifying metadata is stripped locally. In E2EE mode the prompt is encrypted before it ever leaves your browser.",
  },
  {
    icon: ShieldCheck,
    step: "Step 2",
    title: "NotOpen router",
    caption: "A zero-log relay. It selects the best route for your privacy tier and never sees or stores your content.",
  },
  {
    icon: Cpu,
    step: "Step 3",
    title: "Model provider",
    caption: "Inference runs under your chosen tier: anonymized, zero-retention, or inside a hardware-isolated TEE enclave.",
  },
];

function Connector({ delay }: { delay: number }) {
  return (
    <div className="relative h-10 w-px shrink-0 bg-gradient-to-b from-transparent via-white/20 to-transparent sm:h-px sm:w-10 sm:bg-gradient-to-r lg:w-16">
      <motion.span
        className="absolute hidden h-[3px] w-[3px] rounded-full bg-white sm:block"
        style={{ top: -1 }}
        animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, delay, ease: "linear" }}
      />
    </div>
  );
}

export function ArchitectureFlow() {
  return (
    <div>
      <div className="flex flex-col items-stretch sm:flex-row sm:items-center">
        {nodes.map((node, index) => {
          const Icon = node.icon;
          return (
            <div key={node.title} className="contents">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: index * 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
                className="flex-1 rounded-[20px] bg-[var(--landing-card)] p-5 shadow-[var(--landing-card-shadow)]"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--landing-chip)] text-[var(--landing-text)]">
                    <Icon size={16} />
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--landing-faint)]">{node.step}</span>
                </div>
                <h3 className="mt-5 text-[15px] font-semibold text-[var(--landing-text)]">{node.title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-[var(--landing-muted)]">{node.caption}</p>
              </motion.div>
              {index < nodes.length - 1 ? <Connector delay={index * 0.8} /> : null}
            </div>
          );
        })}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.9 }}
        className="mt-6 text-center text-[12px] text-[var(--landing-faint)]"
      >
        The reply travels back over the same path, encrypted end to end.
      </motion.p>
    </div>
  );
}
