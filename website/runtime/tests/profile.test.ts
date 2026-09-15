import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanBio,
  degreeOf,
  expertiseList,
  expertiseOf,
  introOf,
  isRealTitle,
  phoneOf,
  stripTags,
  videoOf,
} from '../src/lib/profile.ts';

const BODY = [
  '<style>/*! elementor */.elementor-widget-image{text-align:center}</style>',
  '<img width="1920" src="http://example.com/123.jpg">',
  '<p>陈爱国 中国政法大学硕士</p>',
  '<p>擅长领域 对合同法 | 公司法 | 金融法 电话：13700368929</p>',
  '<p>个人简介 拥有多年法院工作经历，现任高级合伙人。</p>',
  'https://cdn.example.com/v/10f10303.mp4#t=1',
].join('\n');

test('stripTags: 样式块与标签转纯文本', () => {
  assert.equal(stripTags('<p>陈爱国&nbsp;硕士</p><style>.x{}</style>'), '陈爱国 硕士');
});

test('cleanBio: 去样式块与裸 mp4，保留 video 标签地址', () => {
  const cleaned = cleanBio(`${BODY}<video controls src="http://example.com/promo.mp4"></video>`);
  assert.ok(!cleaned.includes('/*! elementor'), '样式块应去掉');
  assert.ok(!cleaned.includes('cdn.example.com/v/10f10303.mp4'), '裸 mp4 应去掉');
  assert.ok(cleaned.includes('src="http://example.com/promo.mp4"'), 'video 标签地址应保留');
});

test('isRealTitle: 中英文有效，纯数字/空无效', () => {
  assert.equal(isRealTitle('陈爱国'), true);
  assert.equal(isRealTitle('Advantages'), true);
  assert.equal(isRealTitle('123'), false);
  assert.equal(isRealTitle('x.jpg'), false);
  assert.equal(isRealTitle(''), false);
});

test('expertiseOf/expertiseList: 擅长摘录与拆词', () => {
  assert.equal(expertiseOf(BODY, ''), '对合同法 公司法 金融法');
  assert.deepEqual(expertiseList(BODY, ''), ['对合同法', '公司法', '金融法']);
  assert.equal(expertiseOf('', '/*! elementor junk'), '');
  assert.equal(expertiseOf('', '合同纠纷 婚姻家庭'), '合同纠纷 婚姻家庭');
});

test('degreeOf/phoneOf/introOf/videoOf: 人物字段提取', () => {
  assert.equal(degreeOf(BODY, '陈爱国'), '中国政法大学硕士');
  assert.equal(phoneOf(BODY), '13700368929');
  assert.equal(phoneOf('无电话正文'), null);
  assert.equal(introOf(BODY), '拥有多年法院工作经历，现任高级合伙人。');
  assert.equal(videoOf(BODY), 'https://cdn.example.com/v/10f10303.mp4#t=1');
  assert.equal(videoOf('无视频正文'), null);
});
