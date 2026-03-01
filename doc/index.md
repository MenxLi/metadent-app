---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "MetaDent App"
  text: "Image annotation app"
  tagline: "For semi-structured vision-language labeling."
  actions:
    - theme: brand
      text: Get Started
      link: /quick-start
    # - theme: alt
    # text: About
    # link: /about

# features:
#   - title: Feature A
#     details: Lorem ipsum dolor sit amet, consectetur adipiscing elit
#   - title: Feature B
#     details: Lorem ipsum dolor sit amet, consectetur adipiscing elit
#   - title: Feature C
#     details: Lorem ipsum dolor sit amet, consectetur adipiscing elit
---

There are limited free open-source tools for labeling images with multi-modal annotations (e.g., free-text labels + segmentation masks)
which are essential for training/evaluating vision-language models.

This app provides a simple interface for annotating images with:

1. An overall description of the image,
2. A list of free-text labels, each associated with segmentation(s).

It also supports plugin-server, allowing integration with external models for auto-labeling.

## Paper & Citation

MetaDent is a intra-oral image dataset, benchmark, and an annotation app for vision-language tasks in dentistry.
This application is part of the MetaDent project.

> **MetaDent: Labeling Clinical Images for Vision-Language Models in Dentistry**  
> _Meng-Xun Li†, Wen-Hui Deng†, Zhi-Xing Wu, Chun-Xiao Jin, Jia-Min Wu, Yue Han, James Kit Hon Tsoi, Gui-Song Xia*, Cui Huang*_  
> Journal of Dental Research, 2026.  
> [[Paper Link](#)] [[Project Page](https://menxli.github.io/metadent/)]

<!-- ```bibtex
@article{metadent_jdr_2026,
  title={MetaDent: Labeling Clinical Images for Vision-Language Models in Dentistry},
  author={Meng-Xun Li and Wen-Hui Deng and Zhi-Xing Wu and Chun-Xiao Jin and Jia-Min Wu and Yue Han and James Kit Hon Tsoi and Gui-Song Xia and Cui Huang},
  journal={Journal of Dental Research},
  publisher={SAGE Publications},
  doi={10.1177/00220345261424242},
  year={2026}
}
``` -->
