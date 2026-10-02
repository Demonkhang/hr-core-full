import { Component, ReactNode } from 'react';
import { Button, Result } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Result
            status="error"
            title="Đã xảy ra lỗi"
            subTitle={this.state.error?.message || 'Vui lòng thử lại'}
            extra={[
              <Button key="retry" type="primary" onClick={this.handleReset}>
                Thử lại
              </Button>,
              <Button key="home" onClick={() => window.location.href = '/'}>
                Về trang chủ
              </Button>,
            ]}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
