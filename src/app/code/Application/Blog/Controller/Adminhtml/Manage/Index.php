<?php
declare(strict_types=1);
namespace Application\Blog\Controller\Adminhtml\Manage;
class Index extends Action implements \Magento\Framework\App\Action\HttpGetActionInterface
{
    public function execute() { return $this->page('Blog ' . ucfirst($this->section())); }
}
