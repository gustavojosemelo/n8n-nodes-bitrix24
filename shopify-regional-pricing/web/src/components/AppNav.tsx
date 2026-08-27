import { ButtonGroup, Button } from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Navegacao interna do app. O operador nunca precisa sair daqui para mexer
 * em preco — as variantes do admin nativo sao detalhe de implementacao.
 */
export function AppNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items = [
    { label: 'Regiões', to: '/regions' },
    { label: 'Saúde', to: '/health' },
    { label: 'Configurações', to: '/settings' },
  ];

  return (
    <ButtonGroup variant="segmented">
      {items.map((item) => (
        <Button
          key={item.to}
          pressed={pathname.startsWith(item.to)}
          onClick={() => navigate(item.to)}
        >
          {item.label}
        </Button>
      ))}
    </ButtonGroup>
  );
}
