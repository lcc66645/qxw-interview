"""Render the reviewed campaign's two static comparison figures."""

import json
import os
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/tmp/qxw-matplotlib")

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ticker import FixedLocator, FuncFormatter

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "data/campaign-review.json").read_text())
FONT = Path(os.environ.get("QXW_CHART_FONT", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"))
font_manager.fontManager.addfont(str(FONT))
plt.rcParams.update({
    "font.family": font_manager.FontProperties(fname=str(FONT)).get_name(),
    "font.size": 12,
    "axes.unicode_minus": False,
    "axes.facecolor": "none",
    "figure.facecolor": "none",
    "text.color": "#202c29",
    "axes.labelcolor": "#52615c",
    "xtick.color": "#52615c",
    "ytick.color": "#52615c",
    "axes.edgecolor": "#93a69c",
    "savefig.facecolor": "none",
})


def finish(ax):
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_linewidth(0.8)
    ax.tick_params(length=4, width=0.8, pad=9)
    ax.set_axisbelow(True)


def mix_comparison():
    fig, ax = plt.subplots(figsize=(11.2, 5.4), dpi=180)
    fig.subplots_adjust(left=0.22, right=0.92, top=0.70, bottom=0.17)
    fig.text(0.04, 0.90, "播放表现与拉新贡献", size=21, weight="medium")
    fig.text(0.04, 0.82, "中秋国庆项目 · 2026/09/24–10/08", size=12, color="#52615c")
    groups = DATA["groups"][:2]
    for index, group in enumerate(groups):
        for offset, field, color, label in [(-0.17, "vvShare", "#477dc0", "内容 VV 占比"), (0.17, "acquisitionShare", "#16705b", "拉新占比")]:
            value = group[field] * 100
            ax.barh(index + offset, value, height=0.27, color=color, label=label if index == 0 else None)
            ax.text(value + 1.1, index + offset, f"{value:.1f}%", va="center", fontsize=13, color=color)
    ax.set_yticks(range(2), ["两个拉新主力卖点", "三个流量型卖点"])
    ax.invert_yaxis()
    ax.set_xlim(0, 75)
    ax.set_xticks([0, 20, 40, 60])
    ax.xaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:g}%"))
    ax.grid(axis="x", color="#52615c", alpha=0.12)
    ax.legend(loc="lower right", frameon=False, bbox_to_anchor=(1.02, 1.01), ncol=2, labelcolor="#202c29", fontsize=11)
    finish(ax)
    fig.text(0.04, 0.045, "主力方向：帮选车 + 查优惠、AI 语音讲车；流量型方向：精准估价、交易避坑、约试驾。", size=10, color="#52615c")
    fig.savefig(ROOT / "assets/review-vv-vs-growth.png")
    plt.close(fig)


def selling_point_scatter():
    fig, ax = plt.subplots(figsize=(11.2, 7.0), dpi=180)
    fig.subplots_adjust(left=0.12, right=0.95, top=0.78, bottom=0.19)
    fig.text(0.04, 0.95, "卖点 VV 与拉新效率", size=21, weight="medium")
    fig.text(0.04, 0.875, "9个卖点 · 气泡面积对应拉新人数 · 拉新效率按舍入 VV 估算", size=12, color="#52615c")
    baseline = DATA["overview"]["acquisitionsPerMillion"]
    ax.axvline(410, color="#93a69c", lw=1.0, linestyle=(0, (4, 4)), alpha=0.7)
    ax.axhline(baseline, color="#93a69c", lw=1.0, linestyle=(0, (4, 4)), alpha=0.7)
    offsets = [(16, 20), (-113, 31), (-4, 15), (-125, -13), (-123, -32), (18, 30), (14, -31), (-109, 15), (13, 12)]
    names = ["帮选车 + 查优惠", "AI 语音讲车", "精准估价", "二手车知识问答", "智能找二手车", "二手车交易避坑", "AI 约试驾", "拍照识故障", "拍报价单（1条）"]
    for index, point in enumerate(DATA["points"]):
        x, y = point["vv"] / 10000, point["acquisitionsPerMillion"]
        color = "#23866a" if index < 2 else "#477dc0"
        if point["acquisitions"]:
            ax.scatter(x, y, s=point["acquisitions"] * 10, facecolor=color, edgecolor="#ffffff", linewidth=0.8, alpha=0.9, zorder=3)
        else:
            ax.scatter(x, y, s=60, marker="x", color=color, linewidth=1.4, zorder=3)
        ax.annotate(names[index], (x, y), xytext=offsets[index], textcoords="offset points", color="#202c29", fontsize=11, arrowprops={"arrowstyle": "-", "color": "#52615c", "lw": 0.7}, zorder=4)
    ax.set_xscale("log")
    ax.set_xlim(3.5, 1250)
    ax.set_ylim(-0.8, 16.8)
    ax.xaxis.set_major_locator(FixedLocator([5, 10, 50, 100, 410, 1000]))
    ax.xaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:g}"))
    ax.minorticks_off()
    ax.set_yticks([0, 4, 8, 12, 16])
    ax.set_xlabel("总 VV（万；对数轴）", labelpad=13)
    ax.set_ylabel("每百万 VV 拉新人数（估算）", labelpad=12)
    ax.grid(axis="y", color="#52615c", alpha=0.1)
    ax.text(1170, baseline + 0.3, f"大盘 {baseline:.2f} 人/百万 VV", ha="right", fontsize=10, color="#52615c")
    ax.text(440, 16.2, "均卖点 VV 410万", fontsize=10, color="#52615c")
    finish(ax)
    fig.text(0.04, 0.055, "总览与明细存在差异；单点据明细，基准据总览。0拉新用 × 表示，单条样本不推断稳定效果。", size=10, color="#52615c")
    fig.savefig(ROOT / "assets/review-selling-points.png")
    plt.close(fig)


if __name__ == "__main__":
    mix_comparison()
    selling_point_scatter()
    print("Rendered review-vv-vs-growth.png and review-selling-points.png from campaign-review.json")
