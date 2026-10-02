import React from 'react';
import { Col } from 'antd';

type ColSpanType = number | string;
type FlexType = number | 'none' | 'auto';
interface ColSize {
  flex?: FlexType;
  span?: ColSpanType;
  order?: ColSpanType;
  offset?: ColSpanType;
  push?: ColSpanType;
  pull?: ColSpanType;
}

export interface SafeColProps {
  children?: React.ReactNode;
  flex?: FlexType;
  span?: ColSpanType;
  order?: ColSpanType;
  offset?: ColSpanType;
  push?: ColSpanType;
  pull?: ColSpanType;
  prefixCls?: string;
  xs?: ColSpanType | ColSize;
  sm?: ColSpanType | ColSize;
  md?: ColSpanType | ColSize;
  lg?: ColSpanType | ColSize;
  xl?: ColSpanType | ColSize;
  xxl?: ColSpanType | ColSize;
  style?: React.CSSProperties;
  className?: string;
  id?: string;
  key?: React.Key;
}

export function SafeCol({ children, ...rest }: SafeColProps) {
  return React.createElement(Col, rest as any, children);
}
